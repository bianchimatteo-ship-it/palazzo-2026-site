// The specification “POLITICANDO 2026 — Database politici e partiti — 24/09/2026” inside the real dataset:
// collocazione of every entity, new entities without duplicates, verified leadership, lists → parties,
// party logos of politicians derived from the database, the real opening poll and the real majority.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const file = name => new URL(`../src/data/real/${name}`, import.meta.url);
const fingerprint = async () => { const hash = createHash('sha256'); for (const name of ['parties.json', 'politicians.json', 'electoral-lists.json', 'party-memberships.json', 'polls.json']) hash.update(await readFile(file(name))); return hash.digest('hex'); };
const before = await fingerprint();
// The same module instance the game uses (imports carry the build version).
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const realData = await import(`../src/data/repositories/real-data.js${build ? `?v=${build}` : ''}`);
const links = await import('../src/data/repositories/party-links.js');
await realData.loadRealDatabase();
await realData.loadRealCollections(['parties', 'politicalMovements', 'coalitions', 'electoralLists', 'partyMemberships', 'politicians', 'politicalFigures', 'partyLeaderships', 'government', 'twoPerThousand', 'realPolls', 'parliamentaryGroups', 'territories', 'elections', 'electionParticipations', 'groupMemberships', 'offices']);
const db = realData.realDatabase;
const organizations = [...db.parties, ...db.politicalMovements];
const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'").toLocaleLowerCase('it-IT').replace(/\s+/g, ' ').trim();
const byName = name => [...organizations, ...db.coalitions].filter(item => norm(item.officialName) === norm(name));

// ---------- §2 collocazione ----------
const expected = { 'Partito della Rifondazione Comunista - Sinistra Europea': 'estrema sinistra', 'Partito Democratico': 'centro-sinistra', "Fratelli d'Italia - Alleanza Nazionale": 'destra', 'Futuro Nazionale': 'destra', 'MoVimento 5 Stelle': 'centro-sinistra', 'AZIONE': 'centro', 'Noi Moderati': 'centro-destra', 'Movimento politico Forza Italia': 'centro-destra', 'Europa Verde-Verdi': 'sinistra', 'Unione per il Trentino': 'centro' };
for (const [name, position] of Object.entries(expected)) assert.equal(byName(name)[0]?.politicalPosition, position, `Collocazione di ${name}`);
assert.ok([...organizations, ...db.coalitions].every(item => links.POLITICAL_POSITIONS.includes(item.politicalPosition)), 'Ogni partito, movimento e coalizione ha la collocazione del documento.');

// ---------- §4 new entities, once each, with official sources ----------
const NEW = { 'Forza Nuova': ['politicalMovement', 'estrema destra'], 'CasaPound Italia': ['politicalMovement', 'estrema destra'], 'Alleanza Verdi e Sinistra': ['coalition', 'sinistra'], 'Democrazia Sovrana Popolare': ['party', 'sinistra'], 'Partito Popolare del Nord - Autonomia e Libertà': ['party', 'centro-destra'], 'Potere al Popolo!': ['politicalMovement', 'estrema sinistra'], 'Partito Comunista Italiano': ['party', 'sinistra'], 'Partito Comunista dei Lavoratori': ['party', 'estrema sinistra'], 'Partito Sardo d’Azione': ['party', 'centro-destra'], 'Rete dei Patrioti': ['politicalMovement', 'estrema destra'], 'ORA!': ['party', 'centro'] };
for (const [name, [type, position]] of Object.entries(NEW)) {
  const found = byName(name);
  assert.equal(found.length, 1, `${name}: un solo record`);
  assert.equal(found[0].entityType, type, `${name}: tipo`);
  assert.equal(found[0].politicalPosition, position, `${name}: collocazione`);
  assert.ok(found[0].source === 'real' && found[0].verified === true && /^https?:\/\//.test(found[0].sourceUrl) && found[0].verifiedAt === '2026-09-24', `${name}: fonte ufficiale`);
}
const lists = { 'Libertà': 'centro', 'Stati Uniti d’Europa': 'centro', 'Pace Terra Dignità': 'sinistra', 'Partito Animalista - Italexit per l’Italia': 'destra' };
for (const [name, position] of Object.entries(lists)) {
  const found = db.electoralLists.filter(item => norm(item.officialName) === norm(name));
  assert.equal(found.length, 1, `${name}: lista elettorale unica`);
  assert.equal(found[0].electionId, 'election-it-europee-2024');
  assert.equal(found[0].politicalPosition, position);
  assert.equal(found[0].partyId, null, `${name}: una lista non diventa un partito`);
}
assert.equal(byName('Liberali Democratici Europei').length, 0, 'Liberali Democratici Europei non è un secondo record…');
assert.ok(byName('Partito Liberaldemocratico')[0].aliases.some(alias => alias.name === 'Liberali Democratici Europei'), '…ma una denominazione riconciliata con il Partito Liberaldemocratico.');
assert.equal(organizations.filter(item => norm(item.officialName).includes('forza italia')).length, 1, 'Movimento politico Forza Italia resta un solo record.');
assert.equal(byName('Alleanza Verdi e Sinistra')[0].componentPartyIds.length, 2);
assert.equal(db.parties.find(item => item.id === 'party-partito-sardo-d-azione').regionId, 'it-region-20', 'Il PSd’Az è un partito regionale della Sardegna.');
// MEF names of registered parties: reconciled, never offered twice.
const { isSelectableParty } = await import('../src/data/schema.js');
assert.equal(db.parties.find(item => item.id === 'party-mef-2025-15').sameEntityAs, 'party-registro-p1-2022-63-ir');
assert.ok(!isSelectableParty(db.parties.find(item => item.id === 'party-mef-2025-15')), 'Il nome MEF del M5S non compare come secondo partito.');

// ---------- §3 leadership ----------
const leader = (party, role) => db.partyLeaderships.filter(item => item.partyId === byName(party)[0]?.id && item.role === role).map(item => db.politicalFigures.find(figure => figure.id === item.politicalFigureId)?.fullName);
assert.deepEqual(leader('Partito Democratico', 'Segretaria nazionale'), ['Elly Schlein']);
assert.deepEqual(leader('Partito Liberale Italiano', 'Presidente'), ['Stefano de Luca'], 'Nome esattamente come nel documento.');
assert.deepEqual(leader('ORA!', 'Segretario'), ['Michele Boldrin']);
assert.deepEqual(leader('Potere al Popolo!', 'Portavoce').sort(), ['Giuliano Granato', 'Marta Collot']);
assert.deepEqual(leader('Futuro Nazionale', 'Presidente'), ['Roberto Vannacci'], 'I dati già verificati di Futuro Nazionale restano.');
for (const open of ['Partito Comunista dei Lavoratori', 'Rete dei Patrioti', 'Alleanza Verdi e Sinistra']) assert.equal(db.partyLeaderships.filter(item => item.partyId === byName(open)[0].id).length, 0, `${open}: nessun vertice senza fonte ufficiale`);
assert.ok(db.partyLeaderships.every(item => item.source === 'real' && item.verified === true && /^https?:\/\//.test(item.sourceUrl)), 'Ogni incarico ha la sua fonte.');
const figuresByName = new Map(db.politicalFigures.map(item => [item.fullName, item]));
assert.equal(figuresByName.get('Elly Schlein').politicianId, 'camera-xix-deputato-308930', 'La figura è collegata alla sua scheda da deputata.');
assert.equal(figuresByName.get('Matteo Salvini').politicianId, 'senato-xix-senatore-25407');
assert.equal(figuresByName.get('Roberto Fiore').politicianId, null, 'Chi non è parlamentare resta una figura senza scheda.');
assert.equal(new Set(db.politicalFigures.map(item => norm(item.fullName))).size, db.politicalFigures.length, 'Nessuna figura duplicata.');
assert.equal(db.politicians.length, 604, 'I 604 parlamentari restano gli stessi, senza duplicati.');

// ---------- §6 lists → parties, and the party of each politician ----------
const list = name => db.electoralLists.find(item => item.officialName === name || item.registeredName === name);
// Names in normal capitalisation (never all capitals); the form of the source stays in registeredName.
assert.ok(db.politicians.every(item => /\p{Ll}/u.test(item.fullName)) && db.electoralLists.every(item => /\p{Ll}/u.test(item.officialName)) && db.parties.every(item => /\p{Ll}/u.test(item.officialName) || !/\p{L}{2}/u.test(item.officialName)), 'Nessun nome politico tutto in maiuscolo.');
assert.equal(db.politicians.find(item => item.registeredName === "ALESSANDRO URZI'")?.fullName, 'Alessandro Urzì', 'Il nome della fonte resta in registeredName; l’apostrofo usato come accento diventa accento.');
assert.equal(list("FRATELLI D'ITALIA CON GIORGIA MELONI").officialName, "Fratelli d'Italia con Giorgia Meloni");
assert.equal(list("FRATELLI D'ITALIA CON GIORGIA MELONI").partyId, 'party-registro-p1-2014-04-ir');
assert.equal(list('FORZA ITALIA').partyId, 'party-registro-p1-2015-20-ir');
assert.equal(list('AZIONE - ITALIA VIVA - CALENDA').partyId, null, 'Una lista di due partiti non diventa iscrizione a uno solo.');
assert.deepEqual(list('AZIONE - ITALIA VIVA - CALENDA').componentPartyIds, ['party-registro-p1-2019-51-ir', 'party-registro-p1-2019-52-ir']);
assert.equal(list('ALLEANZA VERDI E SINISTRA').coalitionId, 'coalition-alleanza-verdi-sinistra');
assert.equal(list("FRATELLI D'ITALIA - LEGA - NM - UDC - FI-PPE").partyId, null);
const person = id => db.politicians.find(item => item.id === id);
const affiliation = id => links.politicianAffiliation(person(id));
assert.equal(affiliation('camera-xix-deputato-308930').entity.officialName, 'Partito Democratico');
assert.equal(affiliation('camera-xix-deputato-308930').basis, 'membership', 'Un incarico documentato vale come iscrizione.');
assert.equal(affiliation('camera-xix-deputato-307143').entity.id, 'party-futuro-nazionale', 'Un incarico documentato prevale sulla lista d’elezione.');
// The 2022 list is an electoral relation, never the current party (people change party during the legislature).
const byList = db.politicians.find(item => item.electedOnList === 'MOVIMENTO 5 STELLE' && !db.partyMemberships.some(member => member.politicianId === item.id));
assert.equal(links.politicianAffiliation(byList), null, 'La lista d’elezione non diventa il partito attuale.');
assert.equal(links.electionListOf(byList).entity.id, 'party-registro-p1-2022-63-ir', 'La lista resta come relazione elettorale, separata.');
const coalitionOnly = db.politicians.find(item => item.electedOnList === "FRATELLI D'ITALIA - LEGA - NM - UDC - FI-PPE" && !db.partyMemberships.some(member => member.politicianId === item.id));
assert.equal(links.politicianAffiliation(coalitionOnly), null, 'Eletti in collegi di coalizione: nessun partito dedotto.');
const senator = db.politicians.find(item => item.chamber === 'senato' && !db.partyMemberships.some(member => member.politicianId === item.id));
assert.equal(links.politicianAffiliation(senator), null, 'Il gruppo parlamentare non viene mai usato per dedurre il partito.');
assert.ok(links.linkedPoliticians('party-registro-p1-2015-29-ir').some(item => item.person.id === 'camera-xix-deputato-308930'), 'Iscritti documentati del partito.');
assert.ok(links.electedOnListsOf('party-registro-p1-2015-29-ir').length > 50, 'Eletti nelle liste del partito, come relazione elettorale.');
assert.deepEqual(links.governingEntityIds().sort(), ['party-registro-p1-2014-04-ir', 'party-registro-p1-2015-20-ir', 'party-registro-p1-2017-41-ir'], 'Maggioranza reale derivata dai membri del governo in carica.');

// ---------- party logos instead of initials, derived from the database ----------
const { renderPoliticianArchive, renderPoliticianProfile } = await import('../src/ui/politician-archive.js');
const { renderPartyArchive, renderPartyProfile } = await import('../src/ui/party-archive.js');
const logoFor = entity => entity.id === 'party-registro-p1-2015-29-ir' ? 'https://example.org/pd.svg' : entity.logoAsset ? `http://localhost/${entity.logoAsset}` : null;
const filters = { politicianQuery: 'schlein', politicianChamber: 'all', politicianParty: 'all', politicianGroup: 'all', politicianPage: 1 };
let html = renderPoliticianArchive(filters, { logoFor });
assert.ok(html.includes('src="https://example.org/pd.svg"') && html.includes('person-mark'), 'Nella lista, al posto dell’iniziale, il logo del partito.');
html = renderPoliticianArchive({ ...filters, politicianQuery: 'ziello' }, { logoFor });
assert.ok(html.includes('futuro-nazionale.png'), 'Il logo verificato di Futuro Nazionale.');
html = renderPoliticianArchive({ ...filters, politicianQuery: person(byList.id).fullName.toLowerCase() }, { logoFor });
assert.ok(html.includes('class="catalog-mark"') && html.includes('Partito non documentato') && html.includes('Lista 2022: Movimento 5 Stelle'), 'Senza partito documentato: iniziale della Camera; la lista 2022 resta indicata a parte.');
html = renderPoliticianArchive({ ...filters, politicianQuery: senator.fullName.toLowerCase() }, { logoFor });
assert.ok(html.includes('class="catalog-mark"'), 'Senza partito documentato resta l’iniziale della Camera.');
html = renderPoliticianArchive({ ...filters, politicianQuery: '', politicianParty: 'party-registro-p1-2015-29-ir' }, { logoFor });
assert.ok(html.includes('Elly Schlein') && !html.includes('ELLY SCHLEIN'), 'Filtro per partito collegato; nomi in maiuscolo normale, mai tutto maiuscolo.');
html = renderPoliticianProfile('camera-xix-deputato-308930', { logoFor });
assert.ok(html.includes('pd.svg') && html.includes('centro-sinistra'), 'La scheda mostra logo e collocazione del partito.');
const catalog = { partyQuery: '', partyType: 'all', partyPresence: 'all', partyLevel: 'all', partyRegion: 'all', partyStatus: 'all', partyElection: 'all', partySort: 'name', partyPage: 20 };
html = renderPartyArchive(catalog, { logoFor });
assert.ok(html.includes('Alleanza Verdi e Sinistra') && html.includes('Coalizione') && html.includes('Lista elettorale') && html.includes('position-chip'), 'Archivio con coalizioni e liste separate e collocazione.');
assert.equal((html.match(/data-party-profile="party-mef-2025-15"/g) ?? []).length, 0, 'Nessun doppione del M5S nell’archivio.');
html = renderPartyArchive({ ...catalog, partyPosition: 'estrema destra' }, { logoFor });
assert.ok(html.includes('Forza Nuova') && html.includes('CasaPound Italia') && !html.includes('Partito Democratico'), 'Filtro per collocazione.');
html = renderPartyProfile('party-registro-p1-2015-29-ir', logoFor);
assert.ok(html.includes('Elly Schlein') && html.includes('Parlamentari collegati') && html.includes('Eletti nel 2022 nelle liste'), 'Scheda del partito: organi, iscritti documentati ed eletti nelle liste, separati.');
html = renderPartyProfile('party-registro-p1-2022-63-ir', logoFor);
assert.ok(html.includes('2×1000'), 'Il 2‰ registrato con il nome MEF compare nella scheda del partito.');

// ---------- the real opening poll ----------
const poll = db.realPolls[0];
assert.equal(poll.publishedAt, '2026-09-24');
assert.ok(/agi\.it/.test(poll.sourceUrl) && poll.source === 'real');
assert.equal(poll.results.find(row => row.entityId === 'party-registro-p1-2014-04-ir').share, 27.0);
assert.equal(db.realPolls.length, 1, 'Il sondaggio del 24/09 sostituisce quello del 17/09.');
const { store } = await import('../src/core/store.js');
store.setRealReference({ twoPerThousand: db.twoPerThousand, parties: db.parties, movements: db.politicalMovements, coalitions: db.coalitions, polls: db.realPolls, governingIds: links.governingEntityIds(), startDate: db.manifest.snapshotDate });
const draft = { firstName: 'Anna', lastName: 'Prova', birthDate: '1988-03-01', gender: 'donna', region: 'Lazio', municipality: 'Viterbo', previousProfession: 'Insegnante', initialLevel: 'comunale', partyMode: 'new', partyName: 'Lista di prova', partyAbbreviation: 'LDP', partyDescription: 'Partito creato per il test.', partyOrientation: 'Altro', partyColor: '#285c42', partyPosition: 'centro-sinistra', difficulty: 'difficile', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } };
store.createCareer(draft, db.parties, db.parliamentaryGroups);
let state = store.getState();
assert.equal(state.clock.currentDate, '2026-09-24', 'La nuova carriera parte dalla data dello snapshot reale.');
assert.equal(state.career.startedAt, '2026-09-24');
const first = state.world.polls[0];
assert.ok(first.real.publishedAt <= state.clock.currentDate, 'Il sondaggio reale è quello disponibile alla data di avvio.');
assert.equal(first.source, 'real', 'La carriera parte dal sondaggio reale.');
assert.equal(first.results.find(row => row.partyId === 'party-registro-p1-2015-29-ir').share, 20.8);
assert.equal(first.results.find(row => row.partyId === 'coalition-alleanza-verdi-sinistra').share, 6.5, 'AVS entra come coalizione, con il suo dato reale.');
assert.equal(first.results.find(row => row.partyId === 'party-registro-p1-2022-67-ir').share, 1.1, 'Sud chiama Nord è nella fonte del 24/09.');
assert.ok(!first.results.some(row => row.partyId === 'party-registro-p1-2024-74-ir'), 'Il Partito Liberaldemocratico non è nella fonte del 24/09: nessuna riga.');
assert.ok(first.results.find(row => row.partyId === state.world.playerPartyId).simulated, 'Il partito creato dal giocatore è una stima simulata, dichiarata.');
assert.equal(state.world.parties.find(item => item.id === 'party-registro-p1-2014-04-ir').governing, true);
assert.equal(state.world.parties.find(item => item.id === 'party-registro-p1-2015-29-ir').strategy, 'opposizione', 'Chi è fuori dalla maggioranza reale parte all’opposizione.');
assert.equal(state.world.parties.find(item => item.isPlayer).position, 'centro-sinistra', 'Il partito del giocatore ha la collocazione scelta.');
assert.equal(state.career.difficulty, 'difficile');
store.advance(7);
state = store.getState();
assert.notEqual(state.world.polls.at(-1).source, 'real', 'Dalla prima settimana i sondaggi sono simulati.');
assert.ok(/simulat/i.test(state.world.polls.at(-1).institute));
const { renderPollsPage } = await import('../src/ui/polls-mode.js');
html = renderPollsPage({ ...state, world: { ...state.world, polls: [first] } }, {});
assert.ok(html.includes('DATO REALE') && html.includes('agi.it') && html.includes('dalla prima settimana i sondaggi sono simulati'), 'Il primo sondaggio è indicato come reale, con la fonte.');
assert.equal(await fingerprint(), before, 'I file dei dati reali non vengono toccati dal gioco.');
console.log(`Documento del 24/09/2026 verificato: ${organizations.length + db.coalitions.length} entità con collocazione, ${Object.keys(NEW).length + Object.keys(lists).length + 1} nuove entità del §4 senza doppioni (11 organizzazioni, 4 liste europee, LDE riconciliato con il PLD; nomi MEF non duplicati), ${db.partyLeaderships.length} incarichi con fonte ufficiale, liste 2022 collegate senza trasformare liste plurali in iscrizioni, loghi dei partiti al posto delle iniziali derivati dal database, maggioranza reale derivata dal governo, sondaggio reale Supermedia del 24/09/2026 all’avvio e poi simulazione.`);
