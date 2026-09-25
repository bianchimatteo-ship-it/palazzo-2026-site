// Presence of the forces in the polls. The first poll is a snapshot of the real source: only the forces it measures,
// with its figures, "Altri" as the source leaves it and the player's party apart as a marked simulated estimate. Then
// forces enter and leave the survey (not surveyed → emerging → surveyed → consolidated, and out again) through
// thresholds, minimum permanence and cooldowns; history, charts and normalization follow without broken series.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const realFiles = ['parties.json', 'political-movements.json', 'coalitions.json', 'polls.json', 'two-per-thousand.json'];
const fingerprint = async () => { const hash = createHash('sha256'); for (const name of realFiles) hash.update(await readFile(new URL(`../src/data/real/${name}`, import.meta.url))); return hash.digest('hex'); };
const before = await fingerprint();
// The same module instances the game uses (imports carry the build version).
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const realData = await import(`../src/data/repositories/real-data.js${v}`);
const links = await import(`../src/data/repositories/party-links.js${v}`);
await realData.loadRealDatabase();
await realData.loadRealCollections(['parties', 'politicalMovements', 'coalitions', 'twoPerThousand', 'realPolls', 'government', 'politicians', 'parliamentaryGroups', 'partyMemberships', 'electoralLists']);
const db = realData.realDatabase;
const engine = await import(`../src/core/world-engine.js${v}`);
const { store } = await import(`../src/core/store.js${v}`);
const { renderPollsPage } = await import(`../src/ui/polls-mode.js${v}`);
const { PRESENCE, PRESENCE_RULES } = engine;
const reference = () => ({ twoPerThousand: db.twoPerThousand, parties: db.parties, movements: db.politicalMovements, coalitions: db.coalitions, polls: db.realPolls, governingIds: links.governingEntityIds(), startDate: db.manifest.snapshotDate });
const catalog = new Map([...db.parties, ...db.politicalMovements, ...db.coalitions].map(item => [item.id, item]));
const canonical = id => catalog.get(id)?.sameEntityAs ?? id;
const source = db.realPolls[0];
const sourceTotal = source.results.reduce((sum, row) => sum + row.share, 0);
const PSI = 'party-registro-p1-2014-05-ir';
const PD = 'party-registro-p1-2015-29-ir';
const draft = (extra = {}) => ({ firstName: 'Anna', lastName: 'Prova', birthDate: '1988-03-01', gender: 'donna', region: 'Lazio', municipality: 'Viterbo', previousProfession: 'Insegnante', initialLevel: 'comunale', difficulty: 'normale', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 }, ...extra });
const newParty = { partyMode: 'new', partyId: '', partyName: 'Lista di prova', partyAbbreviation: 'LDP', partyDescription: 'Partito creato per il test.', partyOrientation: 'Altro', partyColor: '#285c42', partyPosition: 'centro-sinistra' };
store.setRealReference(reference());

// ---------- 1. the first poll is a snapshot of the real source ----------
store.createCareer(draft(newParty), db.parties, db.parliamentaryGroups);
let state = store.getState();
let first = state.world.polls[0];
assert.equal(first.source, 'real');
assert.equal(first.results.filter(row => row.real).length, source.results.length, 'Tutte e sole le forze della fonte reale.');
for (const row of source.results) assert.equal(first.results.find(item => item.partyId === canonical(row.entityId))?.share, row.share, `Dato reale di ${row.label}.`);
assert.ok(first.results.every(row => row.real || row.partyId === state.world.playerPartyId), 'Nessun altro partito del database riceve una stima nel primo sondaggio.');
const own = first.results.find(row => row.partyId === state.world.playerPartyId);
assert.ok(own.simulated && own.outsideSource && !own.real, 'Il partito creato dal giocatore compare solo come stima simulata, fuori dalla fonte reale.');
assert.equal(first.others, Math.round((100 - sourceTotal) * 10) / 10, '“Altri” è quello della fonte (100 meno le forze rilevate), separato.');
assert.equal(first.othersSource, 'real');
let html = renderPollsPage(state, {});
assert.ok(html.includes('Fuori dalla fonte reale') && html.includes('Stima simulata · non nella fonte reale') && html.includes(`${String(first.others.toFixed(1)).replace('.', ',')}%`), 'La stima del partito del giocatore è separata e marcata; “Altri” resta quello della fonte.');
assert.equal((html.match(/class="poll-bar-row (?!is-others)/g) ?? []).length, source.results.length + 1, 'Barre: le forze della fonte più la stima del tuo partito (e “Altri” a parte).');
assert.ok(!html.includes('Partito Socialista Italiano'), 'Le forze del database fuori dal sondaggio non hanno una barra né una stima.');

// ---------- 2. every other force of the database can enter later ----------
const measured = new Set(source.results.map(row => canonical(row.entityId)));
const inLists = new Set(db.coalitions.filter(item => measured.has(item.id)).flatMap(item => item.componentPartyIds ?? []));
const eligible = [...db.parties, ...db.politicalMovements].filter(item => item.source === 'real' && item.verified === true && !item.sameEntityAs && item.status === 'active' && !measured.has(item.id) && !inLists.has(item.id)).map(item => item.id);
const latentIds = state.world.latent.map(item => item.id);
assert.deepEqual([...latentIds].sort(), [...eligible].sort(), 'Tutti i partiti e movimenti reali attivi fuori dal primo sondaggio sono in attesa, senza doppioni.');
assert.ok(latentIds.includes(PSI) && !latentIds.includes('party-registro-p1-2014-10-ir') && !latentIds.includes('party-mef-2025-15'), 'Esclusi i partiti storici e i doppioni MEF.');
assert.ok(!latentIds.includes('party-registro-p1-2014-13-ir') && !latentIds.includes('party-registro-p1-2017-44-ir'), 'Europa Verde e Sinistra Italiana sono già misurate dentro AVS.');
assert.ok(state.world.latent.every(item => item.presence.status === PRESENCE.NONE && item.source === 'simulation' && item.support > 0), 'Fuori dai sondaggi, con un consenso latente simulato.');
const latentTotal = state.world.latent.reduce((sum, item) => sum + item.support, 0);
assert.ok(Math.abs(latentTotal + state.world.residual - first.others) < 0.05, 'Il consenso latente è una parte di “Altri”: nessun punto inventato.');
assert.ok(latentTotal < first.others, '“Altri” comprende anche liste minori non censite.');
store.advance(7);
state = store.getState();
let poll = state.world.polls.at(-1);
assert.equal(poll.source, 'simulation');
assert.ok(poll.results.every(row => !latentIds.includes(row.partyId)), 'Una forza non rilevata resta dentro “Altri” anche nei sondaggi simulati.');
assert.ok(Math.abs(poll.results.reduce((sum, row) => sum + row.share, 0) + poll.others - 100) < 0.3, 'Righe e “Altri” fanno 100.');
assert.ok(poll.results.find(row => row.partyId === state.world.playerPartyId).internal, 'Il partito appena fondato non è ancora rilevato dagli istituti: stima interna marcata.');
html = renderPollsPage(state, {});
assert.ok(html.includes('Non ancora rilevato · stima interna') && html.includes('Chi entra e chi esce') && html.includes('Non rilevati · '), 'Pagina: stima interna, pannello della presenza nei sondaggi.');

// A real party of the poll: no estimate at all. A real party outside the poll: only its own marked estimate.
store.createCareer(draft({ partyMode: 'existing', partyId: PD }), db.parties, db.parliamentaryGroups);
first = store.getState().world.polls[0];
assert.ok(first.results.every(row => row.real) && first.results.length === source.results.length, 'Con un partito presente nella fonte il primo sondaggio è solo reale.');
store.createCareer(draft({ partyMode: 'existing', partyId: PSI }), db.parties, db.parliamentaryGroups);
state = store.getState();
first = state.world.polls[0];
assert.ok(first.results.find(row => row.partyId === PSI)?.outsideSource, 'Il partito reale scelto, assente dalla fonte, è una stima simulata marcata.');
assert.ok(!state.world.latent.some(item => item.id === PSI) && state.world.parties.filter(item => item.id === PSI).length === 1, 'Nessun doppione tra partito del giocatore e forze in attesa.');

// ---------- 3. entering: thresholds and permanence, from a condition ----------
const addDays = (date, days) => { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10); };
const forces = [
  { id: 'a', label: 'Destra A', share: 34, position: 'destra', governing: true }, { id: 'b', label: 'Centrosinistra A', share: 28.4, position: 'centro-sinistra' },
  { id: 'c', label: 'Centro A', share: 15, position: 'centro' }, { id: 'd', label: 'Destra B', share: 20, position: 'destra' }, { id: 'small', label: 'Centro B', share: 1.1, position: 'centro' }
];
const testPoll = { id: 'prova', label: 'Media reale di prova', publishedAt: '2026-09-17', sourceUrl: 'https://example.org/sondaggio', sourceName: 'Fonte di prova', results: forces.map(item => ({ partyId: item.id, share: item.share })) };
const latent = [{ id: 'lat-a', label: 'Forza in attesa A', position: 'centro-sinistra', weight: 1 }, { id: 'lat-b', label: 'Forza in attesa B', position: 'destra', weight: 0.5 }, ...Array.from({ length: 8 }, (_, i) => ({ id: `lat-${i}`, label: `Forza in attesa ${i}`, position: 'centro', weight: 0 }))];
const makeWorld = seed => engine.createWorld({ seedText: seed, date: '2026-09-24', place: { region: 'Lazio' }, playerParty: { id: 'io', label: 'Il mio partito', position: 'centro', founder: true }, forces, realPoll: testPoll, latent });
const step = (input, week, date, extra = {}) => engine.advanceWorld(input, { date, week, stats: { popularity: 45, reputation: 55, notoriety: 40 }, society: { mood: 50, moodDelta: 0, trust: 48, sentiment: 0 }, ...extra }).world;
let world = makeWorld('presenza');
assert.ok(Math.abs(world.others - 1.5) < 0.05 && world.latent.length === 10);
// Without a condition nothing enters: no rise, no crossing of the thresholds.
world.cooldowns.rise = 100000;
let date = '2026-09-24';
let week = 1;
for (; week < 31;) { week++; date = addDays(date, 7); world = step(world, week, date); }
assert.ok(world.latent.every(item => item.presence.status === PRESENCE.NONE), 'Nessun ingresso casuale: senza una condizione le forze in attesa restano fuori.');
assert.ok(world.presenceMoves.every(move => !move.id.startsWith('lat-')), 'Nessun movimento per le forze in attesa.');
// A crisis in a close party moves voters towards the close forces outside the polls (a condition, not luck).
const control = structuredClone(world);
world.parties.find(item => item.id === 'b').crisis = { since: week, source: 'simulation' };
world.parties.find(item => item.id === 'b').cohesion = 12;
let calm = control;
const startB = world.parties.find(item => item.id === 'b').baseline;
for (let i = 0; i < 6; i++) { week++; date = addDays(date, 7); world = step(world, week, date); calm = step(calm, week, date); }
assert.ok(world.latent.find(item => item.id === 'lat-a').support > calm.latent.find(item => item.id === 'lat-a').support + 0.08, 'La crisi di un partito vicino sposta consenso verso la forza in attesa vicina.');
assert.ok(world.parties.find(item => item.id === 'b').baseline < startB, 'Il partito in crisi perde terreno.');
// A rise (triggered by such a condition) must still pass every threshold: emerging first, surveyed only later.
world = structuredClone(control);
const rising = world.latent.find(item => item.id === 'lat-a');
rising.rise = { since: week, until: week + 30, rate: 0.07, reason: 'prova' };
// A party's own level (anchor) moves only when voters really leave it.
const donorsBefore = world.parties.find(item => item.id === 'b').anchor;
let emergedAt = null, enteredAt = null;
for (let i = 0; i < 30 && !enteredAt; i++) {
  week++; date = addDays(date, 7);
  world = step(world, week, date);
  const force = world.latent.find(item => item.id === 'lat-a') ?? world.parties.find(item => item.id === 'lat-a');
  if (!emergedAt && force.presence.status === PRESENCE.EMERGING) emergedAt = week;
  if (!enteredAt && engine.isSurveyed(force) && world.parties.includes(force)) enteredAt = week;
  if (!enteredAt) assert.ok(!world.polls.at(-1).results.some(row => row.partyId === 'lat-a'), 'Finché non è rilevata non ha una riga nel sondaggio.');
}
assert.ok(emergedAt && enteredAt, 'Con una crescita che regge, la forza emerge e poi entra nei sondaggi.');
assert.ok(enteredAt - emergedAt >= Math.max(PRESENCE_RULES.enter.minWeeks, PRESENCE_RULES.enter.weeks - 1), `Permanenza minima da emergente (${enteredAt - emergedAt} settimane).`);
assert.ok(world.parties.find(item => item.id === 'b').anchor < donorsBefore - 0.05, 'Il consenso guadagnato viene dai partiti vicini, non dal nulla.');
const entrant = world.parties.find(item => item.id === 'lat-a');
assert.ok(entrant && !world.latent.some(item => item.id === 'lat-a'), 'Entrando diventa una forza del mondo politico.');
assert.ok(/^#[\da-f]{6}$/i.test(entrant.color) && entrant.enteredWeek === enteredAt && entrant.presence.entries === 1 && entrant.refSource === 'real', 'Acquista colore, serie e storico da quel momento; l’identità resta reale.');
assert.ok(world.polls.at(-1).results.some(row => row.partyId === 'lat-a'), 'Ha una propria riga nel sondaggio.');
assert.ok(world.polls.at(-1).moves.some(move => move.id === 'lat-a' && move.to === PRESENCE.SURVEYED), 'Il sondaggio registra l’ingresso della settimana.');
assert.ok(world.events.some(event => event.kind === 'sondaggi' && event.title === 'Forza in attesa A entra nei sondaggi' && /simulat/.test(event.body)), 'La cronaca racconta l’ingresso (simulazione).');
html = renderPollsPage({ world, parliament: null, game: null }, {});
assert.ok(html.includes('delta-new') && html.includes('Forza in attesa A'), 'La nuova forza compare con l’indicazione “nuovo”.');
for (let i = 0; i < 3; i++) { week++; date = addDays(date, 7); world = step(world, week, date); }
html = renderPollsPage({ world, parliament: null, game: null }, {});
assert.ok(!/ d="L/.test(html) && !/ d="\s*L/.test(html) && !html.includes('NaN'), 'Grafico del trend senza serie rotte per chi entra a metà.');

// ---------- 4. leaving the survey keeps the history; cooldown before coming back ----------
const small = () => world.parties.find(item => item.id === 'small');
Object.assign(small(), { baseline: 0.35, anchor: 0.35 });
const weekDrop = week;
let exitedAt = null;
// Temporary effects (events that favour small parties) can keep it up for a while: only the lasting level counts.
for (let i = 0; i < 40 && !exitedAt; i++) {
  week++; date = addDays(date, 7);
  world = step(world, week, date);
  if (small().presence.status === PRESENCE.NONE) exitedAt = week;
}
assert.ok(exitedAt && exitedAt - weekDrop >= PRESENCE_RULES.exit.weeks, `Esce solo dopo ${PRESENCE_RULES.exit.weeks} settimane sotto la soglia (uscita dopo ${exitedAt - weekDrop}).`);
assert.ok(!world.polls.at(-1).results.some(row => row.partyId === 'small'), 'Uscita: nessuna riga nel sondaggio, il consenso torna in “Altri”.');
assert.ok(world.polls.slice(0, -1).some(item => item.results.some(row => row.partyId === 'small')), 'La sua storia nei sondaggi resta.');
assert.ok(small().presence.exits === 1 && engine.presenceOverview(world).exited.some(item => item.id === 'small'), 'Resta nel mondo politico, segnata come uscita.');
html = renderPollsPage({ world, parliament: null, game: null }, {});
assert.ok(html.includes('uscita S') && !html.includes('NaN') && !/ d="L/.test(html), 'Pagina e grafici si adattano: uscita indicata, nessuna etichetta o serie rotta.');
// Back to strength at once: the cooldown holds it outside, then it emerges and enters again.
Object.assign(small(), { baseline: 2.2, anchor: 2.2 });
let backAt = null, reEmergedAt = null;
for (let i = 0; i < 40 && !backAt; i++) {
  week++; date = addDays(date, 7);
  world = step(world, week, date);
  if (!reEmergedAt && small().presence.status === PRESENCE.EMERGING) reEmergedAt = week;
  if (engine.isSurveyed(small())) backAt = week;
}
assert.ok(reEmergedAt && reEmergedAt - exitedAt >= PRESENCE_RULES.exit.cooldown, `Nessun rientro durante il cooldown (${reEmergedAt - exitedAt} settimane).`);
assert.ok(backAt && small().presence.entries >= 2, 'Dopo il cooldown può rientrare, con la stessa storia.');
for (const item of world.polls.filter(entry => entry.source === 'simulation')) assert.ok(Math.abs(item.results.reduce((sum, row) => sum + row.share, 0) + item.others - 100) < 0.3, `Normalizzazione coerente nella settimana ${item.week}.`);

// ---------- 5. saves made before the presence model ----------
const legacy = structuredClone(world);
for (const party of legacy.parties) delete party.presence;
delete legacy.latent; delete legacy.residual; delete legacy.latentSeeded; delete legacy.presenceMoves;
const normalized = engine.normalizeWorld(legacy);
assert.ok(normalized.parties.every(party => party.presence && engine.isSurveyed(party)), 'Un vecchio salvataggio tiene ogni forza nei sondaggi.');
const migrated = engine.withLatentForces(normalized, latent);
assert.ok(migrated.latentSeeded && migrated.latent.length === latent.filter(item => !migrated.parties.some(party => party.id === item.id)).length, 'Le forze in attesa arrivano nei vecchi salvataggi.');
assert.ok(Math.abs(migrated.residual + migrated.latent.reduce((sum, item) => sum + item.support, 0) - legacy.others) < 0.05, 'Senza cambiare “Altri”.');
// In the store: a save without the forces outside the polls receives them from the database.
store.createCareer(draft(newParty), db.parties, db.parliamentaryGroups);
const live = store.getState();
delete live.world.latent; delete live.world.latentSeeded; delete live.world.residual;
store.setRealReference(reference());
assert.ok(store.getState().world.latentSeeded && store.getState().world.latent.length === eligible.length, 'Migrazione del salvataggio all’avvio.');

assert.equal(await fingerprint(), before, 'I file dei dati reali non vengono toccati.');
console.log(`Sondaggi verificati: primo sondaggio = fotografia della fonte reale (${source.results.length} forze, “Altri” ${String(first.others ?? '').replace('.', ',')}% come nella fonte, partito del giocatore solo come stima simulata separata), ${eligible.length} forze reali del database in attesa senza stime pubblicate, ingresso solo da una condizione con soglie e permanenza (emersa S${emergedAt}, entrata S${enteredAt}), consenso preso ai partiti vicini, colore/serie/storico dall’ingresso, uscita ${exitedAt - weekDrop} settimane dopo il calo (servono ${PRESENCE_RULES.exit.weeks} settimane consecutive sotto soglia) con storia conservata, cooldown di ${reEmergedAt - exitedAt} settimane prima di riemergere, grafici e normalizzazione coerenti, migrazione dei vecchi salvataggi, dati reali intatti.`);
