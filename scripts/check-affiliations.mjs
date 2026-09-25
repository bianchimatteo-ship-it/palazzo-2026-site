// Party, parliamentary group, component and election list stay separate; the owner's corrections (admin archive,
// also the shared one in Workers KV) always win and are never replaced by the base data; AVS is one force in the
// polls while Sinistra Italiana, Europa Verde and AVS stay distinct in the archive; MEF aliases never appear on their
// own; old saves are migrated without losing history.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const realFiles = ['politicians.json', 'party-memberships.json', 'parties.json', 'coalitions.json', 'polls.json', 'parliamentary-groups.json'];
const fingerprint = async () => { const hash = createHash('sha256'); for (const name of realFiles) hash.update(await readFile(new URL(`../src/data/real/${name}`, import.meta.url))); return hash.digest('hex'); };
const before = await fingerprint();
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const COLLECTIONS = ['politicians', 'parliamentaryGroups', 'groupMemberships', 'offices', 'government', 'politicalFigures', 'twoPerThousand', 'realPolls', 'parties', 'politicalMovements', 'coalitions', 'electoralLists', 'partyMemberships'];
const realData = await import(`../src/data/repositories/real-data.js${v}`);
const links = await import(`../src/data/repositories/party-links.js${v}`);
await realData.loadRealDatabase();
await realData.loadRealCollections(COLLECTIONS);
const db = realData.realDatabase;
const byName = (last, first = '') => db.politicians.find(person => person.lastName.toUpperCase() === last.toUpperCase() && person.firstName.toUpperCase().startsWith(first.toUpperCase()));
const partyOf = person => links.politicianAffiliation(person)?.entity?.id ?? null;
const SI = 'party-registro-p1-2017-44-ir', EV = 'party-registro-p1-2014-13-ir', AVS = 'coalition-alleanza-verdi-sinistra';
const M5S = 'party-registro-p1-2022-63-ir', EUROPA = 'party-registro-p1-2018-47-ir', AZIONE = 'party-registro-p1-2019-51-ir', IV = 'party-registro-p1-2019-52-ir', FI = 'party-registro-p1-2015-20-ir';

// ---------- 1. four relations, never mixed ----------
const soumahoro = byName('SOUMAHORO');
assert.equal(partyOf(soumahoro), null, 'Soumahoro: eletto con AVS, oggi nessun partito documentato.');
assert.equal(links.electionListOf(soumahoro).entity.id, AVS, 'La lista d’elezione resta come relazione elettorale.');
assert.equal(links.groupAffiliation(soumahoro).groupName, 'Misto');
for (const person of db.politicians.filter(item => item.electedOnList && !db.partyMemberships.some(member => member.politicianId === item.id))) assert.equal(partyOf(person), null, `${person.fullName}: la lista 2022 non diventa il partito attuale.`);
for (const person of db.politicians.filter(item => !db.partyMemberships.some(member => member.politicianId === item.id))) assert.equal(partyOf(person), null, `${person.fullName}: il gruppo non è un partito.`);
const ziello = byName('ZIELLO');
assert.deepEqual([partyOf(ziello), links.groupAffiliation(ziello).groupName, links.groupAffiliation(ziello).component], ['party-futuro-nazionale', 'Misto', 'Futuro Nazionale Vannacci - Free'], 'Gruppo Misto e componente distinti; partito documentato.');
assert.equal(links.groupLabel(links.groupAffiliation(ziello)), 'Misto · componente Futuro Nazionale Vannacci - Free');
assert.equal(partyOf(byName('FRATOIANNI')), SI, 'Fratoianni: Sinistra Italiana (non la coalizione AVS).');
assert.equal(links.electionListOf(byName('FRATOIANNI')).entity.id, AVS);
assert.equal(partyOf(byName('BONELLI')), EV, 'Bonelli: Europa Verde.');
assert.equal(partyOf(byName('BONETTI')), AZIONE, 'Bonetti: presidente di Azione.');
assert.equal(partyOf(byName('FURLAN')), IV, 'Furlan: Italia Viva dal 2025.');
assert.equal(partyOf(byName('FLORIDIA', 'BARBARA')), M5S);
assert.equal(partyOf(byName('FLORIDIA', 'AURORA')), 'party-registro-p1-2014-07-ir', 'Aurora Floridia: Verdi del Sudtirolo, nel gruppo Per le Autonomie.');
assert.equal(links.groupAffiliation(byName('FLORIDIA', 'AURORA')).groupName, 'Per le Autonomie (SVP-PATT, Campobase)');
assert.equal(partyOf(byName('LOMBARDO')), AZIONE);
assert.equal(links.groupAffiliation(byName('LOMBARDO')).groupName, 'Misto', 'Lombardo: partito Azione, gruppo Misto.');
assert.equal(partyOf(byName('CASINI')), null, 'Casini: il partito (Centristi per l’Europa) non è nel database; il gruppo PD non lo sostituisce.');
assert.equal(partyOf(byName('TAJANI', 'ANTONIO')), FI);
assert.equal(partyOf(byName('BERGAMINI', 'DEBORAH')), FI, 'Deborah Bergamini: vicesegretaria di Forza Italia.');
assert.deepEqual(links.governingEntityIds().sort(), ['party-registro-p1-2014-04-ir', FI, 'party-registro-p1-2017-41-ir'].sort(), 'La maggioranza reale dai partiti documentati dei membri del governo.');
// Bagnai: mandate ended on 15/09/2026 (Antitrust); he stays in the archive, not among those in office.
const bagnai = byName('BAGNAI');
assert.ok(bagnai.termEnd === '2026-09-15' && !links.inOffice(bagnai), 'Bagnai non è più deputato in carica.');
assert.ok(!links.electedOnListsOf('party-registro-p1-2017-41-ir').some(item => item.person.id === bagnai.id) && db.parliamentaryGroups.find(item => item.id === 'cam-xix-03').memberCount === 56, 'Fuori dagli elenchi in carica e dal conteggio del gruppo.');
const { selectContacts } = await import(`../src/core/contacts-engine.js${v}`);
assert.ok(!selectContacts({ politicians: db.politicians, groups: db.parliamentaryGroups, offices: db.offices, region: 'Abruzzo', seedText: 'prova' }).some(item => item.politicianId === bagnai.id || item.id === bagnai.id), 'Non diventa un contatto della carriera.');

// ---------- 2. the owner's corrections win and are never replaced ----------
// The shared archive (Workers KV) as the game stores it: links, a group of the other Chamber, hidden aliases, colours.
const archive = {
  version: 1, updatedAt: '2026-09-24T22:20:35.168Z', configured: true, source: 'user', logos: {}, addedParties: {},
  parties: { [FI]: { fields: { abbreviation: 'FI', color: '#264d82' }, updatedAt: '2026-09-24T22:18:16.254Z' }, 'party-futuro-nazionale': { fields: { color: '#0f2960' }, updatedAt: '2026-09-24T17:53:14.323Z' } },
  politicians: {
    [byName('EVI').id]: { fields: { partyId: 'party-registro-p1-2015-29-ir' }, updatedAt: '2026-09-24T21:00:00.000Z' },
    [byName('PRETTO').id]: { fields: { groupId: 'senato-xix-gruppo-56', partyId: FI }, updatedAt: '2026-09-24T21:12:58.959Z' },
    [byName('POZZOLO').id]: { fields: { groupId: 'cam-xix-10', partyId: 'party-futuro-nazionale' }, updatedAt: '2026-09-24T21:12:04.824Z' },
    [byName('BONETTI').id]: { fields: { partyId: IV }, updatedAt: '2026-09-24T21:30:00.000Z' }
  },
  hidden: { 'party-mef-2025-15': { hidden: true, deleted: false, updatedAt: '2026-09-24T20:52:30.162Z' }, 'party-mef-2025-21': { hidden: true, deleted: false, updatedAt: '2026-09-24T20:52:53.020Z' } }
};
mem.set('politicando.admin.shared.v1', JSON.stringify(archive));
const withAdmin = await import(`../src/data/repositories/real-data.js${v}&archivio=1`);
await withAdmin.loadRealDatabase();
await withAdmin.loadRealCollections(COLLECTIONS);
const adb = withAdmin.realDatabase;
const edited = (id, key) => adb.politicians.find(person => person.id === id)[key];
for (const [id, edit] of Object.entries(archive.politicians)) for (const [key, value] of Object.entries(edit.fields)) assert.equal(edited(id, key), value, `Modifica dell’amministratore conservata: ${key} di ${id}.`);
assert.equal(links.politicianAffiliation(adb.politicians.find(p => p.id === byName('BONETTI').id), adb).entity.id, IV, 'Il collegamento dell’amministratore prevale sull’iscrizione documentata.');
assert.equal(links.politicianAffiliation(adb.politicians.find(p => p.id === byName('EVI').id), adb).basis, 'admin');
const pretto = adb.politicians.find(p => p.id === byName('PRETTO').id);
const prettoGroup = links.groupAffiliation(pretto, adb);
assert.ok(pretto.groupId === 'senato-xix-gruppo-56' && prettoGroup.group.chamber === 'camera' && prettoGroup.corrected, 'Un gruppo dell’altra Camera resta com’è nell’archivio ed è letto (e segnalato) come il gruppo omonimo della Camera.');
const pozzolo = links.groupAffiliation(adb.politicians.find(p => p.id === byName('POZZOLO').id), adb);
assert.deepEqual([pozzolo.groupName, pozzolo.component], ['Misto', 'Futuro Nazionale Vannacci - Free'], 'Gruppo Misto scelto dall’amministratore, componente dal database.');
assert.equal([...adb.parties, ...adb.politicalMovements].find(p => p.id === FI).abbreviation, 'FI', 'La sigla scelta dall’amministratore resta.');
assert.ok([...adb.parties, ...adb.politicalMovements].filter(p => p.sameEntityAs).every(p => p.adminHidden), 'Gli alias MEF nascosti restano nascosti.');

// ---------- 3. AVS: distinct in the archive, one force in the polls ----------
assert.ok([SI, EV].every(id => db.parties.some(p => p.id === id)) && db.coalitions.some(c => c.id === AVS), 'Sinistra Italiana, Europa Verde e AVS restano tre entità distinte.');
const { renderPartyArchive } = await import(`../src/ui/party-archive.js${v}`);
const archiveHtml = renderPartyArchive({ partyQuery: '', partyType: 'all', partyPresence: 'all', partyLevel: 'all', partyRegion: 'all', partyStatus: 'all', partyElection: 'all', partySort: 'name', partyPage: 20 }, { logoFor: () => null });
assert.ok(archiveHtml.includes(`data-party-profile="${SI}"`) && archiveHtml.includes(`data-party-profile="${EV}"`) && archiveHtml.includes(`data-party-profile="${AVS}"`), 'Tre schede distinte nell’archivio.');
for (const alias of ['party-mef-2025-15', 'party-mef-2025-21']) assert.ok(!archiveHtml.includes(`data-party-profile="${alias}"`), `L’alias ${alias} non compare come partito separato.`);
const { store } = await import(`../src/core/store.js${v}`);
const reference = () => ({ twoPerThousand: db.twoPerThousand, parties: db.parties, movements: db.politicalMovements, coalitions: db.coalitions, polls: db.realPolls, governingIds: links.governingEntityIds(), startDate: db.manifest.snapshotDate });
store.setRealReference(reference());
const draft = extra => ({ firstName: 'Anna', lastName: 'Prova', birthDate: '1988-03-01', gender: 'donna', region: 'Toscana', municipality: 'Siena', previousProfession: 'Insegnante', initialLevel: 'comunale', difficulty: 'normale', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 }, ...extra });
store.createCareer(draft({ partyMode: 'existing', partyId: SI }), db.parties, db.parliamentaryGroups);
let state = store.getState();
assert.equal(state.career.partyId, SI, 'Il partito del giocatore resta Sinistra Italiana.');
assert.equal(state.world.playerPartyId, AVS, 'Nei sondaggi il suo partito è misurato dentro AVS.');
assert.ok(state.world.parties.find(p => p.id === AVS).isPlayer && !state.world.parties.some(p => [SI, EV].includes(p.id)), 'Nessuna forza separata per SI o Europa Verde.');
assert.ok(state.world.polls[0].results.every(row => row.real) && state.world.polls[0].results.filter(row => row.partyId === AVS).length === 1, 'Primo sondaggio: una sola riga AVS, dato reale.');
for (let week = 0; week < 6; week++) store.advance(7);
state = store.getState();
assert.ok(state.world.polls.every(poll => !poll.results.some(row => [SI, EV, 'party-mef-2025-15', 'party-mef-2025-21'].includes(row.partyId))), 'Nessuna serie per SI, EV o alias.');
const { renderPollsPage } = await import(`../src/ui/polls-mode.js${v}`);
assert.ok(renderPollsPage(state, {}).includes('Il tuo partito, Sinistra Italiana, è rilevato nei sondaggi dentro'), 'Il barometro spiega che il partito è rilevato dentro AVS.');

// ---------- 4. old saves: two forces for AVS, alias ids — merged without losing history ----------
store.createCareer(draft({ partyMode: 'existing', partyId: EV }), db.parties, db.parliamentaryGroups);
for (let week = 0; week < 4; week++) store.advance(7);
const live = store.getState();
// Rebuild the structure of an old save: AVS recorded as its two components, M5S under its MEF alias.
const avs = live.world.parties.find(p => p.id === AVS);
const half = value => Math.round(value * 50) / 100;
live.world.parties = live.world.parties.filter(p => p.id !== AVS);
live.world.parties.push({ ...avs, id: SI, label: 'Sinistra Italiana', baseline: half(avs.baseline), anchor: half(avs.anchor), isPlayer: false }, { ...avs, id: EV, label: 'Europa Verde-Verdi', baseline: half(avs.baseline), anchor: half(avs.anchor), isPlayer: true });
live.world.playerPartyId = EV;
const m5s = live.world.parties.find(p => p.id === M5S);
m5s.id = 'party-mef-2025-15';
const sums = live.world.polls.map(poll => { const row = poll.results.find(r => r.partyId === AVS); return row?.share ?? null; });
live.world.polls = live.world.polls.map(poll => ({ ...poll, results: poll.results.flatMap(row => row.partyId === AVS ? [{ ...row, partyId: SI, share: half(row.share) }, { ...row, partyId: EV, share: Math.round((row.share - half(row.share)) * 100) / 100 }] : row.partyId === M5S ? [{ ...row, partyId: 'party-mef-2025-15' }] : [row]) }));
const pollCount = live.world.polls.length;
store.setRealReference(reference());
const migrated = store.getState().world;
assert.ok(!migrated.parties.some(p => [SI, EV, 'party-mef-2025-15'].includes(p.id)) && migrated.parties.filter(p => p.id === AVS).length === 1 && migrated.parties.some(p => p.id === M5S), 'Migrazione: una sola AVS, M5S con il suo id canonico.');
assert.equal(migrated.polls.length, pollCount, 'Nessun sondaggio perso.');
migrated.polls.forEach((poll, index) => { if (sums[index] !== null) assert.ok(Math.abs(poll.results.find(r => r.partyId === AVS).share - sums[index]) < 0.11, `Storico di AVS ricomposto nella settimana ${poll.week}.`); });
assert.ok(migrated.parties.find(p => p.id === AVS).isPlayer && migrated.playerPartyId === AVS, 'Il giocatore di Europa Verde resta collegato ad AVS.');
assert.ok(migrated.polls.every(poll => poll.results.filter(r => r.partyId === M5S).length === 1), 'Serie del M5S continua sotto un solo id.');
const trend = renderPollsPage({ ...store.getState(), world: migrated }, {});
assert.ok(!trend.includes('NaN') && !/ d="L/.test(trend), 'Grafici senza serie rotte dopo la migrazione.');
// The owner's colours and abbreviations reach the forces of the polls, readable on the dark surface.
const { withPartyIdentities, readableOnDark } = await import(`../src/core/world-engine.js${v}`);
const coloured = withPartyIdentities(migrated, { [FI]: { abbreviation: 'FI', color: '#264d82' } });
assert.ok(coloured.parties.find(p => p.id === FI).abbreviation === 'FI' && coloured.parties.find(p => p.id === FI).brandColor === '#264d82' && coloured.parties.find(p => p.id === FI).color === readableOnDark('#264d82'), 'Colore e sigla dell’amministratore usati nei sondaggi.');

assert.equal(await fingerprint(), before, 'I file dei dati reali non vengono toccati dal gioco.');
console.log('Affiliazioni verificate: partito, gruppo, componente e lista d’elezione separati (nessun partito dedotto da lista o gruppo; Misto con componenti), iscrizioni documentate per Tajani, Bergamini, Bonetti, Furlan, Floridia, Lombardo; Bagnai fuori mandato dal 15/09/2026; modifiche dell’amministratore conservate e prevalenti (anche un gruppo dell’altra Camera, solo segnalato); SI, Europa Verde e AVS distinti in archivio e AVS unica forza nei sondaggi; alias MEF mai separati; vecchi salvataggi migrati con storico e grafici intatti.');
