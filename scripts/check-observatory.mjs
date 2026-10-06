// The observatory of the polls (institutes, average, segments, flows, insights), the competitors of the campaigns (the forces that really stand,
// polled week after week to the vote, the runoff included), AVS as a playable force, the alliances inside their windows and the scale of the vote.
// Everything is simulation on real forces; the numbers are reproducible with the same seed and nothing the observatory says moves a vote.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const realFiles = ['parties.json', 'political-movements.json', 'coalitions.json', 'polls.json', 'electoral-lists.json'];
const fingerprint = async () => { const hash = createHash('sha256'); for (const name of realFiles) hash.update(await readFile(new URL(`../src/data/real/${name}`, import.meta.url))); return hash.digest('hex'); };
const before = await fingerprint();
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const realData = await import(`../src/data/repositories/real-data.js${v}`);
const links = await import(`../src/data/repositories/party-links.js${v}`);
await realData.loadRealDatabase();
await realData.loadRealCollections(['parties', 'politicalMovements', 'coalitions', 'twoPerThousand', 'realPolls', 'government', 'politicians', 'parliamentaryGroups', 'groupMemberships', 'offices', 'partyMemberships', 'electoralLists', 'elections', 'electionParticipations', 'territorialUnits', 'municipalities']);
const db = realData.realDatabase;
const engine = await import(`../src/core/world-engine.js${v}`);
const observatory = await import(`../src/core/poll-observatory.js${v}`);
const campaigns = await import(`../src/core/campaign-engine.js${v}`);
const elections = await import(`../src/core/election-engine.js${v}`);
const careerEngine = await import(`../src/core/career-engine.js${v}`);
const societyEngine = await import(`../src/core/society-engine.js${v}`);
const rules = await import(`../src/data/simulation/polling-rules.js${v}`);
const { makeDemoState } = await import(`../src/data/simulation/demo.js${v}`);

const reference = { twoPerThousand: db.twoPerThousand, parties: db.parties, movements: db.politicalMovements, coalitions: db.coalitions, polls: db.realPolls, governingIds: links.governingEntityIds(), startDate: db.manifest.snapshotDate, electoralLists: db.electoralLists };
const draft = (extra = {}) => ({ firstName: 'Anna', lastName: 'Osservatorio', birthDate: '1988-03-01', gender: 'donna', region: 'Lazio', municipality: 'Viterbo', previousProfession: 'Insegnante', initialLevel: 'comunale', difficulty: 'normale', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 }, ...extra });
const newParty = { partyMode: 'new', partyId: '', partyName: 'Lista di prova', partyAbbreviation: 'LDP', partyDescription: 'Partito fondato dal giocatore per il test.', partyOrientation: 'Altro', partyColor: '#285c42', partyPosition: 'centro-sinistra' };
let imports = 0;
const geography = JSON.parse(await readFile(new URL('../src/data/real/electoral-geography.json', import.meta.url), 'utf8'));
const fresh = async () => { const { store } = await import(`../src/core/store.js?obs=${++imports}`); store.setRealReference(reference); store.setElectoralGeography(geography); return store; };
const start = async (extra, level = {}) => { const store = await fresh(); store.createCareer(draft({ ...extra, ...level }), links.politicalForces(db), db.parliamentaryGroups); return store; };
const weeks = (store, count) => { for (let i = 0; i < count; i++) { store.getState().game.status = 'active'; store.advance(7); } };
const playerOf = store => store.getState().world.parties.find(item => item.isPlayer);
const near = (a, b, tolerance, message) => assert.ok(Math.abs(a - b) <= tolerance, `${message} (${a} contro ${b})`);

// ---------- 1. the observatory: four institutes, their average, week after week ----------
const FN = 'party-futuro-nazionale';
const existing = { partyMode: 'existing', partyId: FN };
let store = await start(existing);
weeks(store, 8);
let state = store.getState();
let world = state.world;
const obs = world.observatory;
assert.equal(obs.source, 'simulation');
assert.deepEqual(Object.keys(obs.institutes), rules.POLL_INSTITUTES.map(item => item.id), 'Quattro istituti, A B C D.');
const simulatedWeeks = world.polls.filter(poll => poll.source !== 'real').length;
for (const profile of rules.POLL_INSTITUTES) {
  const history = obs.institutes[profile.id].history;
  assert.equal(history.length, simulatedWeeks, `${profile.name}: una rilevazione per ogni settimana simulata.`);
  for (const reading of history) {
    assert.ok(reading.sample >= profile.sample[0] && reading.sample <= profile.sample[1], `${profile.name}: il campione è quello del suo panel (${reading.sample}).`);
    assert.equal(reading.margin, observatory.marginOf(reading.sample), `${profile.name}: il margine d’errore discende dal campione.`);
    near(reading.rows.reduce((sum, row) => sum + row[1], 0) + reading.others, 100, 0.35, `${profile.name}: voci e “Altri” fanno 100`);
  }
  // No force moves by more than a credible amount between two polls of the same institute (the institute of the headline poll publishes the figures of that poll,
  // which are capped against the previous headline poll of another institute: its own step may exceed the weekly cap by the gap between the two institutes).
  for (let i = 1; i < history.length; i++) for (const row of history[i].rows) { const was = history[i - 1].rows.find(item => item[0] === row[0]); if (was) assert.ok(Math.abs(row[1] - was[1]) <= 2 * observatory.weeklyCap(was[1]) + 0.3, `${profile.name}: nessuna forza salta oltre un passo credibile (${was[1]} → ${row[1]}).`); }
}
assert.notDeepEqual(obs.institutes.a.history.at(-1).rows, obs.institutes.b.history.at(-1).rows, 'Gli istituti non pubblicano gli stessi numeri: ognuno ha il suo errore.');
// The headline poll of the week is the reading of its institute, with the very same figures.
const headline = world.polls.at(-1);
assert.ok(rules.POLL_INSTITUTES.some(item => item.id === headline.instituteId), 'Il sondaggio della settimana dice quale istituto lo ha fatto.');
const own = obs.institutes[headline.instituteId].history.at(-1);
assert.deepEqual(own.rows.map(row => [row[0], row[1]]), headline.results.map(row => [row.partyId, row.share]), 'Il sondaggio-titolo è la lettura del suo istituto.');
// The average weights the institutes by their sample.
const average = obs.average.at(-1);
const top = [...average.rows].sort((a, b) => b[1] - a[1])[0];
const parts = rules.POLL_INSTITUTES.map(profile => { const reading = obs.institutes[profile.id].history.at(-1); return [reading.sample, reading.rows.find(row => row[0] === top[0])?.[1]]; });
near(parts.reduce((sum, [w, value]) => sum + w * value, 0) / parts.reduce((sum, [w]) => sum + w, 0), top[1], 0.06, 'La media è pesata sul campione');
assert.equal(average.institutes, 4);
assert.ok(rules.POLL_INSTITUTES.every(profile => Math.abs(obs.institutes[profile.id].history.at(-1).rows.find(row => row[0] === top[0])[1] - top[1]) < 3), 'Nessun istituto è lontano dalla media più di un margine plausibile.');

// Reading the report changes nothing, and gives the same numbers every time (the observatory is saved, never redrawn by chance).
const society = societyEngine.observatorySociety(state.society);
const frozen = JSON.stringify(world);
const report = engine.observatoryReport(world, society);
assert.equal(JSON.stringify(engine.observatoryReport(world, society)), JSON.stringify(report), 'Stessa pagina, stessi numeri.');
assert.equal(JSON.stringify(world), frozen, 'Aprire la pagina non tocca il mondo (né il generatore casuale).');
assert.deepEqual(report.institutes.map(item => item.id), ['a', 'b', 'c', 'd']);
assert.ok(report.institutes.every(item => item.latest && item.history.length === simulatedWeeks && item.mode && item.weighting), 'Ogni istituto ha serie storica, campione, metodo e ponderazione.');
assert.equal(report.latestAverage.institutes, 4);
// The sample is what is interviewed: it is not the electorate that votes.
assert.ok(report.latestAverage.sample < 10000 && report.latestAverage.sample === rules.POLL_INSTITUTES.reduce((sum, profile) => sum + obs.institutes[profile.id].history.at(-1).sample, 0), 'Il campione degli istituti è piccolo e somma quello dei panel: non è l’elettorato.');

// Saved and reloaded: the same observatory, not a new one.
const reloaded = await fresh();
assert.equal(JSON.stringify(reloaded.getState().world.observatory), JSON.stringify(obs), 'Dopo il ricaricamento l’osservatorio è quello salvato.');
assert.equal(JSON.stringify(engine.observatoryReport(reloaded.getState().world, societyEngine.observatorySociety(reloaded.getState().society))), JSON.stringify(report), 'E lo stesso report.');
// The same world and the same inputs give the same week, observatory included; and the observatory moves nothing of the world's own sequence
// (the headline polls and the random generator are the same with or without it).
const step = { date: '2027-01-14', week: world.week + 1, stats: {}, deltas: {}, game: null, parliament: null };
const withObservatory = engine.advanceWorld(world, { ...step, society: null, observatory: { society } });
const again = engine.advanceWorld(world, { ...step, society: null, observatory: { society } });
const without = engine.advanceWorld(world, { ...step, society: null });
assert.equal(JSON.stringify(withObservatory.world), JSON.stringify(again.world), 'Stesso mondo e stessi input: la stessa settimana, osservatorio compreso.');
assert.deepEqual(withObservatory.world.polls.at(-1), without.world.polls.at(-1), 'Il sondaggio-titolo è lo stesso con o senza osservatorio.');
assert.equal(withObservatory.world.rngState, without.world.rngState, 'L’osservatorio non tocca il generatore casuale del mondo.');
assert.equal(withObservatory.world.observatory.institutes.a.history.length, Math.min(rules.OBSERVATORY_RULES.history, simulatedWeeks + 1), 'Una rilevazione in più per ogni istituto.');
assert.equal(withObservatory.world.observatory.segments.length, obs.segments.length + 1, 'E un’istantanea dei segmenti.');

// Segments: they weigh what they are; the support of a force across them is its national share; the insights read, they do not move.
const seg = report.segments;
assert.ok(seg.segments.length >= 4 && Math.abs(seg.segments.reduce((sum, item) => sum + item.share, 0) - 100) < 0.6, 'I segmenti dell’elettorato sommano 100.');
for (const force of report.forces.slice(0, 6)) {
  const rows = seg.rows[force.id];
  const mean = rows.reduce((sum, item, index) => sum + item.support * seg.segments[index].share / 100, 0);
  near(mean, report.latestAverage.rows.find(row => row.partyId === force.id)?.share ?? force.share, 0.15, `${force.label}: la media dei segmenti è il dato nazionale`);
}
const KINDS = new Set(['forte-tra', 'debole-tra', 'in-crescita', 'bacino', 'da-recuperare', 'forte-in']);
const allInsights = Object.values(report.insights).flat();
assert.ok(allInsights.length > 0 && allInsights.every(item => KINDS.has(item.kind) && typeof item.text === 'string' && typeof item.detail === 'string'), 'Gli insight sono letture: forte tra, debole tra, in crescita, bacino contendibile, area da recuperare.');
assert.ok(allInsights.every(item => !/\d\.\d/.test(item.detail)), 'I numeri degli insight hanno la virgola decimale.');
assert.ok(report.themes.national.length >= 3 && Object.keys(report.themes.bySegment).length === seg.segments.length, 'Temi nazionali e per segmento.');
assert.ok(Object.values(report.loyalty).every(value => value >= 55 && value <= 97) && report.forces.every(force => Array.isArray(report.secondChoice[force.id])), 'Fedeltà e seconda scelta per ogni forza.');
for (const flow of report.flows) assert.ok(flow.points > 0 && report.forces.some(force => force.id === flow.from) && report.forces.some(force => force.id === flow.to), 'I travasi nascono da forze che calano e arrivano a forze che crescono.');

// ---------- 2. consensus at the start: new forces, real forces outside the polls ----------
const playerStart = async (extra, level) => { const s = await start(extra, level); return { store: s, world: s.getState().world, me: playerOf(s) }; };
const createdA = await playerStart(newParty);
const createdB = await playerStart(newParty);
assert.ok(createdA.me.baseline >= 0.01 && createdA.me.baseline <= 0.1, `Una forza nuova parte tra lo 0,01 e lo 0,1% (${createdA.me.baseline}).`);
assert.equal(createdA.me.baseline, createdB.me.baseline, 'Lo stesso partito, nello stesso mondo, parte dallo stesso valore.');
const surveyedIds = new Set(createdA.world.polls[0].results.map(row => row.partyId));
const outside = db.parties.filter(item => item.source === 'real' && item.verified === true && !item.sameEntityAs && item.status === 'active' && !surveyedIds.has(item.id) && !links.isCoalitionList(item));
assert.ok(outside.length > 20, 'Nel database ci sono molti partiti reali fuori dal sondaggio di partenza.');
for (const record of [outside[0], outside[7], outside[13]]) {
  const one = await playerStart({ partyMode: 'existing', partyId: record.id });
  const two = await playerStart({ partyMode: 'existing', partyId: record.id });
  assert.ok(one.me.baseline >= 0.1 && one.me.baseline <= 0.8, `${record.officialName}: una forza reale fuori dalla fonte parte tra lo 0,1 e lo 0,8% (${one.me.baseline}), non dall’1,5–3%.`);
  assert.equal(one.me.baseline, two.me.baseline, `${record.officialName}: valore deterministico.`);
  assert.equal(one.me.refSource, 'real', 'La forza resta reale.');
}
const fnId = FN;
const real = await playerStart({ partyMode: 'existing', partyId: fnId });
const realRow = real.world.polls[0].results.find(row => row.partyId === fnId);
assert.ok(realRow && Math.abs(real.me.baseline - realRow.share) < 0.05 && real.world.polls[0].source === 'real', 'Una forza della fonte reale parte dal valore reale, senza ritocchi.');
// The real forces of the poll are not touched by who the player is.
const alone = createdA.world.polls[0].results.filter(row => row.partyId !== createdA.me.id);
assert.ok(alone.every(row => { const was = real.world.polls[0].results.find(item => item.partyId === row.partyId); return !was || was.share === row.share; }), 'Le forze reali del sondaggio hanno gli stessi valori qualunque sia il partito del giocatore.');

console.log('Osservatorio e consenso iniziale verificati.');

// ---------- 3. AVS: a coalition (a common list), not a party, and a playable force ----------
const AVS = 'coalition-alleanza-verdi-sinistra', SI = 'party-registro-p1-2017-44-ir', EV = 'party-registro-p1-2014-13-ir';
const avsRecord = db.coalitions.find(item => item.id === AVS);
assert.ok(avsRecord && links.entityKind(avsRecord) === 'coalition' && links.isCoalitionList(avsRecord), 'AVS è una coalizione / lista comune.');
assert.ok(!db.parties.some(item => item.id === AVS) && !db.politicalMovements.some(item => item.id === AVS), 'Non è un partito né un movimento.');
assert.deepEqual([...avsRecord.componentPartyIds].sort(), [EV, SI].sort(), 'I componenti sono Sinistra Italiana ed Europa Verde.');
assert.ok([SI, EV].every(id => links.entityKind(db.parties.find(item => item.id === id)) === 'party'), 'I componenti restano partiti reali.');
const forcesOfGame = links.politicalForces(db);
assert.ok([AVS, SI, EV].every(id => forcesOfGame.some(item => item.id === id)), 'Partiti, movimenti e liste comuni sono forze del gioco.');
assert.ok(forcesOfGame.every(item => !item.electionId && links.entityKind(item) !== 'electoralList'), 'Le liste di una singola elezione non sono forze.');
const avs = await playerStart({ partyMode: 'existing', partyId: AVS });
assert.equal(avs.world.playerPartyId ?? avs.me.id, AVS, 'Si può iniziare la carriera come AVS.');
assert.equal(avs.me.label, avsRecord.label ?? avsRecord.officialName ?? avs.me.label);
assert.ok(avs.me.baseline > 3 && avs.me.baseline < 12, `AVS parte dal suo valore reale (${avs.me.baseline}).`);
assert.equal(avs.store.getState().game.party?.affiliation !== undefined, true, 'La carriera è iscritta alla forza AVS.');
weeks(avs.store, 2);
assert.ok(avs.store.getState().world.polls.at(-1).results.some(row => row.partyId === AVS && row.share > 3), 'AVS è misurata come una sola forza nei sondaggi.');
const siStart = await playerStart({ partyMode: 'existing', partyId: SI });
assert.equal(siStart.me.id, AVS, 'Chi sceglie Sinistra Italiana è rilevato dentro AVS (una sola forza, una sola serie).');
assert.equal(siStart.world.playerComponent?.id, SI, 'E il suo partito resta distinto: componente di AVS.');
// The owner manages AVS like any force: colour and logo, through the shared archive, without touching the real data.
const adminStore = await import(`../src/data/repositories/admin-store.js${v}`);
adminStore.saveRecordOverride('coalitions', AVS, { color: '#12a64f' }, avsRecord);
const edited = adminStore.applyAdminOverrides('coalitions', db.coalitions).find(item => item.id === AVS);
assert.equal(edited.color, '#12a64f', 'Il colore di AVS si corregge dall’area amministrativa.');
adminStore.setRecordField('coalitions', AVS, 'color', avsRecord.color ?? '#008000', avsRecord);
adminStore.resetRecordOverride('coalitions', AVS);
assert.equal(adminStore.applyAdminOverrides('coalitions', db.coalitions).find(item => item.id === AVS).color, avsRecord.color, 'E si ripristina.');
adminStore.storeSharedArchive({ parties: {}, politicians: {}, logos: { [AVS]: { url: 'https://example.org/avs.svg', alt: 'Logo AVS' } } });
assert.equal(adminStore.sharedLogos()[AVS].url, 'https://example.org/avs.svg', 'Il logo di AVS passa dall’archivio condiviso, come quello di ogni forza.');
adminStore.storeSharedArchive({ parties: {}, politicians: {}, logos: {} });
assert.deepEqual(links.forceKind(avsRecord, id => db.parties.find(item => item.id === id)), { kind: 'coalition', label: 'Coalizione / lista elettorale', components: avsRecord.componentPartyIds.map(id => db.parties.find(item => item.id === id)).map(item => item.officialName ?? item.name) }, 'Il resolver dice cos’è AVS: coalizione / lista, con i suoi partiti.');
assert.equal(links.forceKind(db.parties.find(item => item.id === SI)), null, 'Un partito registrato non ha bisogno di etichetta.');
assert.equal(links.forceKind({ id: 'partito-utente-x', source: 'user' }).label, 'Partito creato dal giocatore');
console.log('AVS, forza giocabile verificata.');

// ---------- 4. politiche and europee: the forces that really stand, polled week after week to the vote ----------
const level = { initialLevel: 'deputato', parliamentStartMode: 'real-context', parliamentaryGroupId: db.parliamentaryGroups.find(group => group.chamber === 'camera')?.id };
const openElection = (store, type) => { for (let i = 0; i < 400; i++) { if (careerEngine.upcomingElections(store.getState().game).find(item => item.type === type && item.status === 'open')) return true; weeks(store, 1); } return false; };
const realIds = new Set([...db.parties, ...db.politicalMovements, ...db.coalitions].map(item => item.id));
const sameSet = (a, b) => a.length === b.length && a.every(item => b.includes(item));
const national = await start({ ...newParty, region: 'Lazio', municipality: 'Roma' }, level);
assert.ok(openElection(national, 'politiche'), 'Le politiche si aprono entro la legislatura.');
const worldAtVote = national.getState().world;
const surveyedNow = worldAtVote.polls.at(-1).results.map(row => row.partyId);
const politiche = national.startCampaign({ electionType: 'politiche', objective: 'build', role: 'deputato' }, forcesOfGame, { politicians: db.politicians, groups: db.parliamentaryGroups });
const roster = politiche.roster.participants;
assert.ok(surveyedNow.every(id => roster.some(item => item.id === id)), 'Ogni forza che i sondaggi misurano si presenta, e c’è nel campo.');
assert.ok(roster.some(item => item.isPlayer), 'Compreso il partito del giocatore.');
const rivalsOf = campaign => campaign.candidates.filter(item => !item.isPlayer);
assert.ok(sameSet(rivalsOf(politiche).map(item => item.partyId), roster.filter(item => !item.isPlayer).map(item => item.id)), 'Una candidatura per forza del campo: gli stessi id dei sondaggi, nessuna in più e nessuna sparita.');
assert.ok(rivalsOf(politiche).every(item => !item.independent && (realIds.has(item.partyId) || roster.find(entry => entry.id === item.partyId)?.refSource === 'simulation')), 'Nei voti nazionali nessuna candidatura è legata a un partito inventato né è senza partito: solo forze reali (o nate nel mondo e dichiarate simulate).');
assert.ok(rivalsOf(politiche).filter(item => realIds.has(item.partyId)).every(item => item.partyKind === 'reale'), 'Le forze reali restano reali: la candidatura è simulata, il partito no.');
assert.ok(politiche.anchored && politiche.audience && politiche.electorate.electors > 10000000, 'Il campo parte dai sondaggi e conosce l’elettorato reale delle politiche.');
// The unmeasured forces that stand keep their small simulated consensus and stay visible in the observatory.
const unmeasured = roster.filter(item => !item.surveyed && !item.isPlayer);
for (const item of unmeasured) assert.ok(item.share >= 0.05 && item.share < 3, `${item.label}: consenso simulato piccolo (${item.share}).`);
// Week after week, the institutes poll the race: the opening wave, then one every seven days, through to the vote.
const dayOf = () => national.getState().campaign;
let waves = dayOf().polls.waves;
assert.equal(waves.length, 1, 'Al via la prima onda di sondaggi.');
const seen = [];
while (dayOf().status === 'active') { weeks(national, 1); const c = dayOf(); seen.push([c.day, c.polls.waves.length, c.polls.waves.at(-1).day]); if (c.status === 'active') assert.equal(c.polls.waves.at(-1).day, c.day, 'Ogni settimana una nuova onda, lo stesso giorno della campagna.'); }
const finished = dayOf();
assert.equal(finished.status, 'finished');
assert.ok(finished.polls.waves.length >= 5, `Le onde coprono tutta la campagna (${finished.polls.waves.map(item => item.day).join(', ')}).`);
assert.ok(finished.polls.waves.every((wave, index) => index === 0 || wave.day - finished.polls.waves[index - 1].day <= 7), 'Nessun buco tra un sondaggio e l’altro.');
const inField = new Set(finished.candidates.map(item => item.id));
assert.ok(finished.polls.waves.every(wave => wave.groups.length >= 8 && wave.groups.every(group => inField.has(group.id)) && Object.keys(wave.institutes).length === 4), 'Ogni onda sonda le stesse candidature, con i quattro istituti.');
const raceView = campaigns.campaignObservatory(finished, { society: societyEngine.observatorySociety(national.getState().society) });
assert.ok(raceView.rows.length >= 8 && raceView.rows.every(row => row.series.length >= 5) && raceView.institutes.every(item => item.history.length >= 5), 'L’osservatorio della corsa resta consultabile dopo il voto, con la storia di ogni onda.');
assert.ok(raceView.rows.some(row => row.isPlayer) && raceView.rows.filter(row => row.partyKind === 'reale').length >= 8, 'Il giocatore e le forze reali sono tutte nell’osservatorio.');
assert.ok(raceView.average.every(wave => wave.rows.reduce((sum, row) => sum + row.share, 0) <= 100.5), 'Le medie non superano mai il 100%.');

// The real forces of the database that the polls do not measure: they stand when the game says so (last vote, region, emergence), at the 0,1–0,8% of the start.
const latentReal = worldAtVote.latent.filter(force => (force.refSource ?? 'real') === 'real' && !force.regionId && force.weight > 0).sort((a, b) => b.weight - a.weight);
assert.ok(latentReal.length > 3, 'Il database ha partiti reali fuori dai sondaggi.');
const forced = engine.electionRoster(worldAtVote, { type: 'politiche', precedent: [latentReal[0].id, latentReal[1].id] });
for (const id of [latentReal[0].id, latentReal[1].id]) { const row = forced.participants.find(item => item.id === id); assert.ok(row && !row.surveyed && row.reason === 'lista-precedente' && row.share >= 0.05, `${id}: una forza reale, presente nel voto precedente, si presenta anche se i sondaggi non la misurano.`); }
assert.ok(!engine.electionRoster(worldAtVote, { type: 'politiche', precedent: [] }).participants.some(item => item.id === latentReal[2].id), 'Chi non c’era e non emerge non compare per caso.');
const sample = createCampaignFromRoster(forced);
function createCampaignFromRoster(rosterOf, extra = {}) {
  const base = makeDemoState();
  const player = { ...base.dataset.politicians[0], partyId: worldAtVote.parties.find(item => item.isPlayer).id, region: 'Lazio', municipality: 'Roma' };
  return campaigns.createCampaign({ career: { ...base.career, id: 'obs-roster', partyId: player.partyId }, player, statistics: base.dataset.statistics, partyCatalog: [...forcesOfGame, ...worldAtVote.parties.filter(item => item.refSource === 'simulation')], currentDate: '2027-08-12', config: { electionType: 'politiche', role: 'deputato', objective: 'build', roster: rosterOf, forces: engine.forceProfiles(worldAtVote), ...extra } });
}
const standing = sample.candidates.find(item => item.partyId === latentReal[0].id);
assert.ok(standing && standing.partyKind === 'reale' && standing.surveyed === false && standing.rosterReason === 'lista-precedente' && !standing.independent, 'La candidatura di una forza reale non misurata è una forza reale, dichiarata non rilevata.');
const wave = campaigns.pollWave(sample);
assert.ok(wave.groups.some(group => group.id === standing.id) && wave.average.some(row => row[0] === standing.id && row[1] > 0), 'E i sondaggi della campagna la seguono.');
// Not the same roster everywhere: a region has its own forces.
const rosterIn = regionId => engine.electionRoster(worldAtVote, { type: 'politiche', regionId, precedent: [] }).participants.map(item => item.id).sort().join('|');
assert.ok(new Set(['it-region-04', 'it-region-12', 'it-region-19', null].map(rosterIn)).size >= 2, 'Il campo cambia con la regione e con il contesto: non è lo stesso elenco per ogni voto.');

// Europee: the same rule, the roster of that vote.
const eu = await start({ ...newParty, region: 'Lazio', municipality: 'Roma' }, level);
assert.ok(openElection(eu, 'europee'), 'Le europee si aprono nel 2029.');
const europee = eu.startCampaign({ electionType: 'europee', objective: 'build', role: 'eurodeputato' }, forcesOfGame, { politicians: db.politicians, groups: db.parliamentaryGroups });
assert.equal(europee.roster.type, 'europee');
assert.ok(eu.getState().world.polls.at(-1).results.every(row => europee.roster.participants.some(item => item.id === row.partyId)), 'Alle europee si presentano le forze dei sondaggi.');
assert.ok(sameSet(rivalsOf(europee).map(item => item.partyId), europee.roster.participants.filter(item => !item.isPlayer).map(item => item.id)) && rivalsOf(europee).every(item => !item.independent), 'Una candidatura per forza, come alle politiche.');
weeks(eu, 3);
assert.ok(eu.getState().campaign.polls.waves.length >= 3 && eu.getState().campaign.polls.waves.every(item => item.groups.length >= 8), 'Anche alle europee i sondaggi seguono la corsa ogni settimana.');
console.log('Politiche ed europee: forze reali nel campo e sondaggi per tutta la campagna verificati.');

// ---------- 5. local votes: the field changes with the place; real forces, the player's forces, independents; never a made-up party ----------
const demo = makeDemoState();
const myParty = db.parties.find(item => item.id === 'party-registro-p1-2022-63-ir');
const outsider = { id: 'partito-utente-altro-giocatore', source: 'user', status: 'active', verified: false, name: 'Lista creata da un altro giocatore', officialName: 'Lista creata da un altro giocatore', politicalPosition: 'centro', level: 'national' };
const catalog = [...forcesOfGame, outsider];
const REGIONS = [['Lombardia', 'it-region-03'], ['Lazio', 'it-region-12'], ['Campania', 'it-region-15'], ['Trentino-Alto Adige', 'it-region-04'], ['Sicilia', 'it-region-19'], ['Toscana', 'it-region-09']];
const localCampaign = (type, role, region, municipality, id = 'obs-local', config = {}, partyId = myParty.id) => campaigns.createCampaign({ career: { ...demo.career, id, partyId }, player: { ...demo.dataset.politicians[0], partyId, region, municipality }, statistics: demo.dataset.statistics, partyCatalog: catalog, currentDate: '2026-09-25', config: { electionType: type, role, objective: 'win', municipalityBand: 'oltre-15000', place: { municipality, municipalityCode: `${region}-${municipality}`, region }, ...config } });
const fieldOf = campaign => rivalsOf(campaign).map(item => item.partyId ?? 'indipendente').sort().join('|');
const fields = REGIONS.map(([region]) => fieldOf(localCampaign('comunale', 'sindaco', region, `Comune di ${region}`)));
assert.ok(new Set(fields).size >= 4, 'Territori diversi hanno campi diversi: nessun elenco fisso uguale per tutti.');
assert.equal(fieldOf(localCampaign('comunale', 'sindaco', 'Lazio', 'Comune di Lazio')), fieldOf(localCampaign('comunale', 'sindaco', 'Lazio', 'Comune di Lazio')), 'Stesso voto, stesso territorio: lo stesso campo (riproducibile).');
const catalogById = new Map(catalog.map(item => [item.id, item]));
const kindsSeen = new Set();
let independentTotal = 0, withIndependents = 0, outsiders = 0, regionalLeaks = 0, campaignsChecked = 0;
for (let i = 0; i < 70; i++) {
  const [region, regionId] = REGIONS[i % REGIONS.length];
  for (const type of ['comunale', 'regionale']) {
    const c = localCampaign(type, type === 'comunale' ? 'sindaco' : 'presidente', region, `Comune ${i}`, `obs-local-${type}-${i}`);
    campaignsChecked++;
    const rivals = rivalsOf(c);
    const free = rivals.filter(item => item.independent);
    independentTotal += free.length; if (free.length) withIndependents++;
    for (const rival of rivals) {
      kindsSeen.add(rival.partyKind);
      if (rival.independent) { assert.ok(rival.partyId === null && rival.partyKind === 'indipendente' && rival.rosterReason === 'indipendente', 'Un indipendente lo è per dichiarazione: nessun partito, nessun partito inventato.'); continue; }
      const record = catalogById.get(rival.partyId);
      assert.ok(record, `${rival.displayName}: la candidatura simulata appartiene a una forza esistente (reale o del giocatore).`);
      assert.equal(rival.partyKind, record.source === 'user' ? 'utente' : 'reale', 'Reale resta reale, del giocatore resta del giocatore.');
      if (record.regionId && record.regionId !== regionId) regionalLeaks++;
      if (record.id === outsider.id) outsiders++;
      assert.ok(rival.partyId !== myParty.id, 'Il partito del giocatore non è anche un suo avversario.');
    }
  }
}
assert.equal(regionalLeaks, 0, 'Un partito regionale concorre solo nella sua regione.');
assert.ok(withIndependents > 0 && withIndependents < campaignsChecked, `Gli indipendenti compaiono qua e là (${withIndependents} voti su ${campaignsChecked}), non ovunque e non mai.`);
assert.ok(outsiders > 0 && kindsSeen.has('utente') && kindsSeen.has('reale'), 'Tra gli avversari anche una forza creata da un giocatore, accanto a quelle reali.');
const withFree = localCampaign('comunale', 'sindaco', 'Lombardia', 'Milano', 'obs-independents', { independents: 2 });
assert.equal(rivalsOf(withFree).filter(item => item.independent).length, 2, 'Gli indipendenti si possono prevedere esplicitamente.');
assert.ok(rivalsOf(withFree).filter(item => item.independent).every(item => /indipendente/i.test(item.displayName)), 'E si presentano come tali.');
// The candidacy of the player: a party of the database, a party he founded, or nobody.
assert.equal(localCampaign('comunale', 'sindaco', 'Lazio', 'Roma', 'obs-me').candidates[0].partyKind, 'reale');
assert.equal(localCampaign('comunale', 'sindaco', 'Lazio', 'Roma', 'obs-me', {}, outsider.id).candidates[0].partyKind, 'utente', 'Un partito fondato dal giocatore è del giocatore.');
assert.equal(localCampaign('comunale', 'sindaco', 'Lazio', 'Roma', 'obs-me', {}, null).candidates[0].partyKind, 'indipendente');
// AVS (a list of two parties) can stand against the player in a local race like any real force.
let avsStands = 0;
for (let i = 0; i < 80 && !avsStands; i++) avsStands = rivalsOf(localCampaign('regionale', 'presidente', 'Toscana', `Toscana ${i}`, `obs-avs-${i}`)).filter(item => item.partyId === AVS).length;
assert.ok(avsStands > 0, 'AVS concorre come ogni altra forza reale.');
// The campaign polls and the observatory use the very same force ids as the candidacies.
const racing = campaigns.pollWave(localCampaign('regionale', 'presidente', 'Lazio', 'Lazio', 'obs-polls'));
assert.ok(racing.groups.length >= 4 && racing.average.length === racing.groups.length, 'Ogni candidatura è sondata.');

// ---------- 6. the runoff does not interrupt the polls ----------
{
  const split = (campaign, values = [28, 26, 20, 14, 12]) => { campaign.nomination.status = 'approved'; const ids = Object.keys(campaign.territories[0].supportByCandidate); campaign.territories[0].supportByCandidate = Object.fromEntries(ids.map((id, index) => [id, values[index]])); return campaign; };
  let run = split(localCampaign('comunale', 'sindaco', 'Lombardia', 'Milano', 'obs-runoff'));
  run = campaigns.advanceCampaign(run, run.totalDays - run.day);
  assert.equal(run.stage, 'ballottaggio', 'Nessuno vince al primo turno: ballottaggio.');
  const first = run.polls.waves.filter(item => item.stage === 'campagna');
  const head = run.polls.waves.filter(item => item.stage === 'ballottaggio');
  assert.ok(first.length >= 4 && head.length >= 1, 'Le onde del primo turno e, appena parte il ballottaggio, una nuova onda.');
  assert.ok(head.every(wave => wave.groups.length === 2), 'Il ballottaggio si sonda come testa a testa tra i due finalisti.');
  const wasDay = run.day;
  while (run.status === 'active') run = campaigns.advanceCampaign(run, 1);
  const all = run.polls.waves;
  assert.ok(all.every((wave, index) => index === 0 || wave.day >= all[index - 1].day) && all.filter(item => item.stage === 'ballottaggio').every((wave, index, list) => index === 0 || wave.day - list[index - 1].day <= 7), 'I sondaggi non si interrompono tra i due turni.');
  assert.ok(run.day > wasDay && run.status === 'finished', 'Il ballottaggio si conclude.');
  assert.ok(campaigns.campaignObservatory(run, {}).waves >= first.length + 1, 'L’osservatorio conserva anche le onde del ballottaggio.');
}
console.log('Campagne locali, indipendenti, forze del giocatore e ballottaggio verificati.');

// ---------- 7. the scale of the vote, the offers of the endorsers, the single-member district ----------
const campaignRules = await import(`../src/data/simulation/campaign-rules.js${v}`);
const finish = (campaign, { watch = null } = {}) => {
  let run = campaign; run.nomination.status = 'approved';
  while (run.status === 'active') {
    run = campaigns.advanceCampaign(run, 1);
    while (run.pendingEvents.length) { const event = run.pendingEvents[0]; run = campaigns.decideCampaignEvent(run, event.id, event.choices.at(-1).id); }
    watch?.(run);
  }
  return run;
};
// Electors, turnout, voters, valid votes and the sample of the polls are five different quantities, and nothing caps the votes at 100,000.
const wide = finish(localCampaign('regionale', 'presidente', 'Lombardia', 'Lombardia', 'obs-wide', { electorate: { electors: 8200000, validRatio: 0.97, basis: 'registro elettorale' } }));
const count = wide.result.electorate;
assert.ok(!count.normalized && count.electors === 8200000 && count.voters > 3000000 && count.ballots > 3000000 && count.ballots < count.voters && count.voters < count.electors, 'Elettori, votanti e voti validi sono tre numeri diversi, in scala reale.');
assert.equal(wide.result.totalBallots, count.ballots);
assert.ok(Math.max(...wide.result.groups.map(group => group.votes)) > 500000 && Math.abs(wide.result.groups.reduce((sum, group) => sum + group.votes, 0) - count.ballots) <= wide.result.groups.length + count.ballots * 0.001, 'Ogni lista prende centinaia di migliaia di voti, senza tetti, e le liste sommano ai voti validi.');
const racePolls = campaigns.campaignObservatory(wide, {});
assert.ok(racePolls.institutes.every(item => item.latest.sample < 5000 && item.latest.sample !== count.electors), 'Il campione dei sondaggi non è l’elettorato.');
const little = finish(localCampaign('comunale', 'sindaco', 'Lazio', 'Piccolo', 'obs-small', { municipalityBand: 'fino-15000', electorate: { electors: 2600 } }));
assert.ok(little.result.totalBallots > 400 && little.result.totalBallots < 2600 && !little.result.electorate.normalized, 'Un comune piccolo conta le sue poche migliaia di voti, non 100.000.');
const unknown = finish(localCampaign('regionale', 'presidente', 'Lazio', 'Lazio', 'obs-unknown'));
assert.ok(unknown.result.electorate.normalized && unknown.result.electorate.electors === null && unknown.result.totalBallots === 100000 && unknown.electorate.sizeClass === null, 'Senza dimensione nota il conteggio resta normalizzato su 100.000 e lo dichiara; il rumore è neutro, non inventato.');
// The noise of a race depends on how many people decide (the electorate), not on the turnout alone: a large electorate is as neutral as an unknown one (the percentages do
// not change with the scale), a very small one is noisier.
const playerShareOf = config => finish(localCampaign('regionale', 'presidente', 'Lazio', 'Lazio', 'obs-noise', config)).result.playerShare;
const neutral = playerShareOf({});
assert.equal(playerShareOf({ electorate: { electors: 8200000, validRatio: 0.97 } }), neutral, 'La scala non cambia le percentuali: un elettorato grande vale uno sconosciuto.');
assert.notEqual(playerShareOf({ electorate: { electors: 1800, validRatio: 0.97 } }), neutral, 'Un elettorato molto piccolo è più rumoroso: conta la dimensione reale, non solo l’affluenza.');
// The offers of the endorsers: three at most in a whole campaign.
let mostOffers = 0;
for (let i = 0; i < 40 && mostOffers < 3; i++) finish(localCampaign('regionale', 'presidente', 'Lombardia', 'Lombardia', `obs-offers-${i}`), { watch: run => { mostOffers = Math.max(mostOffers, run.endorsements?.offers ?? 0); assert.ok((run.endorsements?.offers ?? 0) <= campaignRules.ENDORSEMENT_RULES.maxOffers, 'Mai più di tre offerte di sostegno in una campagna.'); } });
assert.equal(campaignRules.ENDORSEMENT_RULES.maxOffers, 3);
assert.equal(mostOffers, 3, 'Il tetto di tre offerte è quello effettivo: in alcune campagne si raggiunge e non si supera.');
// A single-member district has no list: no position, nothing to build.
const uninominale = localCampaign('politiche', 'uninominale', 'Lombardia', 'Milano', 'obs-uni');
const listed = localCampaign('politiche', 'deputato', 'Lombardia', 'Milano', 'obs-list');
assert.ok(uninominale.candidacy.listPosition === null && uninominale.nomination.listPosition === null, 'Il collegio uninominale non ha un posto in lista.');
assert.ok(listed.candidacy.listPosition > 0, 'La lista proporzionale sì.');
const listAction = campaignRules.CAMPAIGN_ACTIVITIES.find(item => item.id === 'list_building');
assert.equal(campaigns.activityAvailability(uninominale, listAction).ok, false, 'E nessuna costruzione della lista.');
assert.equal(campaigns.activityAvailability(listed, listAction).ok, true);
assert.equal(finish(uninominale).candidacy.listPosition, null, 'Resta così fino al voto.');
console.log('Scala del voto, offerte di sostegno e collegio uninominale verificati.');

// ---------- 8. alliances: windows, subjects, memory, no duplicate effects ----------
{
  const w = JSON.parse(JSON.stringify(world));
  const me = w.playerPartyId ?? w.parties.find(item => item.isPlayer).id;
  const open = w.alliances.find(item => item.status === 'active' && item.partyIds.length >= 2 && !item.partyIds.includes(me));
  assert.ok(open, 'Nel mondo ci sono coalizioni a cui il partito può aderire.');
  const ties = JSON.stringify(w.ties);
  const joined = engine.joinCoalition(w, open.id, '2027-01-14');
  assert.ok(joined.joined && !joined.already && joined.world.alliances.find(item => item.id === open.id).partyIds.includes(me), 'Si entra in una coalizione.');
  const effects = joined.world.effects.filter(item => item.partyId === me && item.cause === 'alleanza').length;
  const twice = engine.joinCoalition(joined.world, open.id, '2027-01-15');
  assert.ok(twice.joined && twice.already, 'Entrare due volte è un no-op.');
  assert.equal(JSON.stringify(twice.world.ties), JSON.stringify(joined.world.ties), 'Nessun legame in più.');
  assert.equal(twice.world.effects.filter(item => item.partyId === me && item.cause === 'alleanza').length, effects, 'Nessun bonus duplicato.');
  assert.equal(twice.world.events.length, joined.world.events.length, 'Nessuna cronaca duplicata.');
  assert.notEqual(JSON.stringify(joined.world.ties), ties, 'La prima volta i legami cambiano.');
  // One intesa at a time, and only the player's own can be broken.
  const partner = joined.world.parties.find(item => !item.isPlayer && item.active && !(engine.allianceOf(joined.world, item.id)?.partyIds ?? []).includes(me));
  assert.match(engine.allianceBlock(joined.world, partner.id) ?? '', /rompila prima/, 'Chi è già in un’intesa non ne cerca un’altra senza romperla.');
  assert.match(engine.allianceBlock(joined.world, 'forza-che-non-c-e') ?? '', /non è più in campo/);
  const elsewhere = joined.world.alliances.find(item => item.status === 'active' && !item.partyIds.includes(me));
  if (elsewhere) assert.throws(() => engine.breakAlliance(joined.world, elsewhere.id, '2027-01-16'), /solo le intese del tuo partito/, 'Si rompono solo le intese del proprio partito.');
  assert.throws(() => engine.joinCoalition(w, 'coalizione-inesistente', '2027-01-14'), /non è più disponibile/);
  // What kind of agreement it is: an intesa of two forces, a coalition of three or more; and whether it is made of the forces of the government.
  const kind = engine.allianceKind(w, { partyIds: w.parties.slice(0, 2).map(item => item.id), kind: 'intesa' });
  assert.ok(kind.kind === 'intesa' && /Intesa/.test(kind.label), 'Due forze: un’intesa elettorale.');
  assert.equal(engine.allianceKind(w, { partyIds: w.parties.slice(0, 3).map(item => item.id) }).kind, 'coalizione', 'Tre o più: una coalizione.');
  const governing = w.parties.filter(item => item.governing).slice(0, 2).map(item => item.id);
  assert.equal(engine.allianceKind(w, { partyIds: governing, kind: 'intesa' }).government, governing.length === 2, 'Il sostegno al governo si legge a parte.');
}
// The windows (store): from the filing of the lists to the vote, nothing changes; before and after, it can.
{
  assert.equal(national.allianceWindow().open, true, 'Chiusa la campagna, le intese tornano modificabili.');
  const w2 = await start({ ...newParty, region: 'Lazio', municipality: 'Roma' }, level);
  assert.ok(openElection(w2, 'politiche'));
  assert.equal(w2.allianceWindow().open, true, 'Con le candidature aperte le intese si possono ancora trattare.');
  w2.startCampaign({ electionType: 'politiche', objective: 'build', role: 'deputato' }, forcesOfGame, { politicians: db.politicians, groups: db.parliamentaryGroups });
  const others = w2.getState().world.parties.filter(item => !item.isPlayer && item.active);
  let closed = 0;
  while (w2.getState().campaign.status === 'active') {
    weeks(w2, 1);
    const win = w2.allianceWindow();
    if (w2.getState().campaign.status !== 'active') break;
    if (!win.open) {
      closed++;
      assert.match(win.reason, /liste per le politiche sono depositate/);
      assert.throws(() => w2.proposeAlliance(others[0].id), /depositate/, 'Dopo il deposito delle liste non si propongono intese.');
      const any = w2.getState().world.alliances.find(item => item.status === 'active' && item.partyIds.includes(w2.getState().world.playerPartyId));
      if (any) assert.throws(() => w2.breakAlliance(any.id), /depositate/, 'Né si rompono.');
    }
  }
  assert.ok(closed >= 3, `La finestra resta chiusa fino al voto (${closed} settimane).`);
  assert.equal(w2.allianceWindow().open, true, 'E si riapre a voto concluso.');
}
console.log('Alleanze e coalizioni verificate.');

// ---------- 9. the page "Sondaggi e avversari": one centre, seven views, no invalid values ----------
const ui = await import(`../src/ui/observatory-view.js${v}`);
const hub = await import(`../src/ui/elections-hub.js${v}`);
const cleanHtml = (html, name) => { const text = html.replace(/data-[a-z-]+="[^"]*"/g, ''); const match = text.match(/undefined|NaN|\[object Object\]|Infinity/); if (match) console.error(`${name}: valore non valido …${text.slice(Math.max(0, match.index - 120), match.index + 30)}…`); return !match; };
const findForce = id => forcesOfGame.find(item => item.id === id) ?? db.parties.find(item => item.id === id) ?? null;
const kindOf = id => links.forceKind(findForce(id), findForce);
const pageOf = (stateOf, view, extra = {}) => ui.renderObservatory(stateOf, { view, logoFor: () => null, filters: {}, secretary: true, kindOf, window: () => ({ open: true }), ...extra });
const MARKERS = { quadro: ['Media dei sondaggi', 'Intenzioni di voto', 'Come cambiano i consensi', 'forbice'], istituti: ['Come lavora ciascun istituto', 'Istituto A', 'Istituto D', 'Scarto'], segmenti: ['Chi sono gli elettori', 'Giovani', 'Pensionati', 'Che cosa conta ora'], territori: ['regione per regione', 'region-grid', 'Dove è più forte'], forze: ['Le forze in campo', 'Movimento politico', 'Coalizione / lista elettorale', 'Componenti (partiti)', 'Chi entra e chi esce'], candidati: ['Nessuna campagna in corso'], flussi: ['Indecisi', 'Seconda scelta', 'Fedeltà'] };
const baseState = store.getState();
for (const [view] of ui.OBSERVATORY_VIEWS) {
  const html = pageOf(baseState, view);
  assert.ok(cleanHtml(html, view), `Osservatorio · ${view}: nessun valore non valido.`);
  for (const marker of MARKERS[view]) assert.ok(html.includes(marker), `Osservatorio · ${view}: manca «${marker}».`);
  assert.ok(html.includes(`data-section-tab="osservatorio" data-section-tab-value="${view}" aria-selected="true"`), `Osservatorio · ${view}: la vista attiva è segnata.`);
}
for (const profile of rules.POLL_INSTITUTES) {
  const html = pageOf(baseState, 'istituti', { institute: profile.id });
  assert.ok(cleanHtml(html, profile.id) && html.includes(profile.name.replace('Rilevazione simulata ', 'Istituto ')) && html.includes('errore simulato') && html.includes('Variazione') && html.includes('Margine') && html.includes(profile.mode), `Istituto ${profile.id}: letture, variazione, scarto dalla media, margine, metodo.`);
}
// The page of a race: the finished national campaign (the vote is over, its polls stay) and the running European one.
const nationalPage = pageOf(national.getState(), 'candidati');
assert.ok(cleanHtml(nationalPage, 'politiche') && nationalPage.includes('I sondaggi della corsa') && nationalPage.includes('Chi è in corsa') && nationalPage.includes('Forza reale') && nationalPage.includes('La tua candidatura') && /Corsa conclusa/i.test(nationalPage), 'Dopo il voto l’osservatorio mostra l’ultima corsa e i suoi sondaggi.');
const europeanPage = pageOf(eu.getState(), 'candidati');
assert.ok(cleanHtml(europeanPage, 'europee') && /Campagna in corso/i.test(europeanPage) && /onde?<\/span>/.test(europeanPage) && europeanPage.includes('Torna alla campagna'), 'Durante la campagna: onde di sondaggi, candidature, link per tornare alla campagna.');
assert.ok(pageOf(eu.getState(), 'territori').includes('Territori della corsa') || pageOf(eu.getState(), 'territori').includes('TERRITORI DELLA CORSA'), 'I territori della corsa stanno accanto a quelli del Paese.');
// The window of the alliances is said in the forces view.
assert.ok(pageOf(baseState, 'forze', { window: () => ({ open: false, reason: 'Le liste per le politiche sono depositate: intese ferme.' }) }).includes('Intese ferme fino al voto'), 'Quando le intese sono ferme la pagina lo dice.');
// The hub: Sondaggi e avversari is one of its tabs and holds the observatory; the campaign page only points to it.
const hubHtml = hub.renderElectionsHub(baseState, { parties: forcesOfGame, logoFor: () => null, tab: 'avversari', polls: { view: 'segmenti', filters: {} } });
assert.ok(cleanHtml(hubHtml, 'hub') && hubHtml.includes('aria-selected="true">Sondaggi e avversari') && hubHtml.includes('class="polls-page observatory"') && hubHtml.includes('Chi sono gli elettori'), 'Il centro elettorale ospita l’osservatorio nella scheda Sondaggi e avversari.');
const campaignHtml = hub.renderElectionsHub(eu.getState(), { parties: forcesOfGame, logoFor: () => null, tab: 'campagna' });
assert.ok(!campaignHtml.includes('non collegato') && campaignHtml.includes('data-section-tab-value="avversari"'), 'La campagna non ha sondaggi propri né riferimenti non validi: rimanda all’analisi completa.');
assert.ok(!campaignHtml.includes('class="polls-page observatory"'), 'E nessun sondaggio dentro la campagna.');
console.log('Pagina Sondaggi e avversari verificata.');

const after = await fingerprint();
assert.equal(after, before, 'I dati reali non sono stati modificati.');
console.log('Osservatorio, competitor, AVS, alleanze e scala elettorale verificati: istituti A–D con campioni e margini, media pesata, segmenti, temi, travasi e insight senza bonus, consenso iniziale (nuove 0–0,1%, reali fuori fonte 0,1–0,8%), forze reali nel campo di politiche ed europee con sondaggi settimanali, campi locali diversi con indipendenti e forze del giocatore, ballottaggio senza interruzioni, AVS lista giocabile, finestre delle alleanze, offerte di sostegno al massimo tre, collegio uninominale senza lista, elettorati in scala reale.');
