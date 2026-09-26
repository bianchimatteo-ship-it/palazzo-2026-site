// The Government a career finds in office at the start: built from the real situation (the groups of the members of
// the real Government), fully simulated afterwards, never led by the player at the start. From there the gameplay is the
// usual one: support it, ask for a ministry, leave the majority, open a crisis, bring it down, form a new one.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = globalThis.localStorage;
const read = async name => JSON.parse(await readFile(new URL(`../src/data/real/${name}`, import.meta.url), 'utf8'));
const fingerprint = async () => createHash('sha256').update(await readFile(new URL('../src/data/real/government.json', import.meta.url))).update(await readFile(new URL('../src/data/real/politicians.json', import.meta.url))).digest('hex');
const before = await fingerprint();
const db = { government: await read('government.json'), politicians: await read('politicians.json'), parliamentaryGroups: await read('parliamentary-groups.json'), parties: await read('parties.json') };
const { referenceGovernmentSpec } = await import('../src/data/repositories/government-reference.js');
const engine = await import('../src/core/parliament-engine.js');
const { advanceSociety, createSociety } = await import('../src/core/society-engine.js');
const { store } = await import('../src/core/store.js');
const { playerRoles } = await import('../src/core/roles.js');
const { renderParliamentPage } = await import('../src/ui/parliament-mode.js');

// ---------- 1. the starting situation comes from the real data ----------
const spec = referenceGovernmentSpec(db);
assert.deepEqual([...spec.groupIds].sort(), ['cam-xix-01', 'cam-xix-03', 'cam-xix-04', 'senato-xix-gruppo-33', 'senato-xix-gruppo-56', 'senato-xix-gruppo-85'], 'Maggioranza iniziale = gruppi dei componenti del governo reale.');
assert.equal(spec.premierGroupId, 'cam-xix-01', 'Il gruppo del Presidente del Consiglio reale.');
assert.equal(spec.label, 'I Governo Meloni');
assert.ok(spec.ministries.length >= 18 && spec.ministries.every(item => item.portfolio), 'I ministeri reali sono ricondotti ai portafogli del gioco.');
const realNames = db.government[0].members.map(member => member.fullName);
assert.ok(realNames.every(name => !JSON.stringify(spec).includes(name)), 'Nessun nome di persona reale entra nella simulazione.');

// ---------- 2. a new parliamentary career finds a Government in office, without being part of it ----------
const draft = (overrides = {}) => ({ firstName: 'Prova', lastName: 'Governo', birthDate: '1984-04-04', gender: 'donna', region: 'Lazio', municipality: 'Roma', previousProfession: 'Avvocata', initialLevel: 'deputato', parliamentStartMode: 'real-context', parliamentaryGroupId: 'cam-xix-02', partyMode: 'new', partyName: 'Lista di prova governo', partyAbbreviation: 'LPG', partyDescription: 'Partito creato per il test del governo.', partyOrientation: 'Altro', partyColor: '#285c42', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 }, ...overrides });
store.setReferenceGovernment(spec);
store.createCareer(draft(), db.parties, db.parliamentaryGroups);
let state = store.getState();
let government = state.parliament.government;
assert.equal(government.status, 'active', 'All’avvio di una carriera parlamentare c’è un governo in carica.');
assert.equal(government.formedBy, 'reference');
assert.equal(government.primeMinister, 'reference', 'Il Presidente del Consiglio è un ruolo simulato, non il giocatore.');
assert.equal(government.source, 'simulation', 'Il governo della carriera è simulazione…');
assert.ok(government.reference.source === 'real' && government.reference.label === 'I Governo Meloni' && /^http/.test(government.reference.sourceUrl), '…con il riferimento reale separato e con la sua fonte.');
assert.ok(!government.ministers.some(item => item.playerAppointed), 'Il giocatore non è membro del governo.');
assert.ok(government.ministers.length >= 18 && government.ministers.every(item => /simulato/.test(item.appointeeLabel)), 'Ministri come incarichi simulati.');
assert.ok(realNames.every(name => !JSON.stringify(government).includes(name)), 'Nessun ministro reale diventa un personaggio simulato.');
assert.ok(government.stability >= 25 && government.stability <= 80);
assert.ok(!engine.playerInMajority(state.parliament) && !playerRoles(state).primeMinister, 'Dal gruppo PD il giocatore parte all’opposizione.');
assert.ok(state.parliament.history.some(entry => entry.type === 'governo-riferimento'));
let html = renderParliamentPage('governo', state, { secretary: true });
assert.ok(html.includes('GOVERNO IN CARICA · SIMULAZIONE') && html.includes('Offri il sostegno del tuo gruppo') && html.includes('mozione di sfiducia'), 'La pagina Governo mostra il governo e le azioni possibili.');
assert.ok(!/Nessun governo/.test(html), '“Nessun governo” non compare all’avvio.');
const { renderPollsPage } = await import('../src/ui/polls-mode.js');
assert.ok(!renderPollsPage(state, {}).includes('Nessun governo'), 'Nemmeno nei sondaggi, anche se il primo sondaggio non misura il gradimento del governo.');

// ---------- 3. from the opposition: a no-confidence motion against a solid majority fails ----------
state.game.week.ap = 6; state.game.resources.politicalCapital = 60;
store.triggerGovernmentCrisis();
government = store.getState().parliament.government;
assert.equal(government.status, 'crisis');
assert.ok(government.crisisSeverity <= 12, 'Dall’opposizione la crisi è una mozione di sfiducia, non una rottura della maggioranza.');
store.advance(7); store.advance(7);
state = store.getState();
assert.equal(state.parliament.government.status, 'active', 'Il Presidente del Consiglio simulato torna alle Camere e ottiene la fiducia.');
assert.ok(state.parliament.history.some(entry => entry.type === 'fiducia-richiesta') && state.parliament.history.some(entry => entry.type === 'fiducia-ottenuta' && entry.details.renewed));

// ---------- 4. the player's group can offer its support (the majority decides) ----------
let parliament = state.parliament;
const accepted = engine.offerGroupSupport(parliament, state.clock.currentDate, { influence: 60, roll: 0 });
assert.ok(accepted.accepted && accepted.parliament.government.supportingGroupIds.includes('cam-xix-02') && engine.playerInMajority(accepted.parliament), 'Sostegno accettato: il gruppo entra in maggioranza.');
const refused = engine.offerGroupSupport(parliament, state.clock.currentDate, { influence: 30, roll: 0.99 });
assert.ok(!refused.accepted && !engine.playerInMajority(refused.parliament), 'Sostegno respinto: resta all’opposizione.');
state.game.week.ap = 6; state.game.resources.politicalCapital = 60;
store.supportGovernment();
assert.ok(['sostegno-governo', 'sostegno-respinto'].includes(store.getState().parliament.history.at(-1).type), 'Dal gioco la trattativa ha sempre un esito spiegato.');

// ---------- 5. from a group of the majority: a ministry, if the requirements are met ----------
store.setReferenceGovernment(spec);
store.createCareer(draft({ parliamentaryGroupId: 'cam-xix-04', firstName: 'Seconda', partyName: 'Seconda lista di prova', partyAbbreviation: 'SLP' }), db.parties, db.parliamentaryGroups);
state = store.getState();
assert.ok(engine.playerInMajority(state.parliament), 'Da un gruppo della maggioranza il giocatore sostiene il governo…');
assert.ok(!state.parliament.government.ministers.some(item => item.playerAppointed), '…ma non ne è membro.');
state.game.week.ap = 6; state.game.resources.politicalCapital = 60;
assert.throws(() => store.requestGovernmentPost('Innovazione digitale'), /requisiti/, 'Senza influenza, reputazione, esperienza e sostegno nel gruppo non si entra nel governo.');
html = renderParliamentPage('governo', state, { secretary: true });
assert.ok(html.includes('government-requirements') && html.includes('Ritira il sostegno del tuo gruppo'), 'I requisiti mancanti sono spiegati.');
assert.ok(engine.governmentPostProblems(state.parliament, { influence: 50, reputation: 54, experience: 54 }, state.clock.currentDate).length >= 4, 'Un deputato appena eletto non ha ancora i numeri per un ministero.');
const ready = { influence: 70, reputation: 70, experience: 70 };
const strong = { ...state.parliament, player: { ...state.parliament.player, mandateStartedAt: '2025-06-02' }, careerStanding: { ...state.parliament.careerStanding, partySupport: 75 } };
assert.deepEqual(engine.governmentPostProblems(strong, ready, state.clock.currentDate), [], 'Con i requisiti la richiesta si può fare.');
const appointed = engine.requestGovernmentPost(strong, 'Innovazione digitale', state.clock.currentDate, { stats: ready, roll: 0 });
assert.ok(appointed.appointed && engine.activeMinisters(appointed.parliament.government).some(item => item.playerAppointed && item.portfolio === 'Innovazione digitale'), 'Il Presidente del Consiglio (simulato) affida il ministero.');
assert.equal(appointed.parliament.government.primeMinister, 'reference', 'Da ministro il giocatore non diventa Presidente del Consiglio.');
const reshuffle = engine.requestGovernmentPost(strong, 'Salute', state.clock.currentDate, { stats: ready, roll: 0 });
assert.ok(reshuffle.parliament.government.ministers.some(item => item.portfolio === 'Salute' && item.endReason?.includes('Rimpasto')), 'Un ministero occupato passa al giocatore con un rimpasto.');
const no = engine.requestGovernmentPost(strong, 'Salute', state.clock.currentDate, { stats: ready, roll: 0.99 });
assert.ok(!no.appointed && engine.governmentPostProblems(no.parliament, ready, state.clock.currentDate).some(item => /riprova/.test(item)), 'Una richiesta respinta non si ripete subito.');
// In the game: the stats are raised, the request goes through the store, and a ministry opens an office.
for (const item of state.dataset.statistics.filter(entry => entry.subjectId === state.career.playerId && ['influence', 'reputation', 'experience'].includes(entry.metric))) item.value = 80;
state.parliament.careerStanding.partySupport = 80;
state.parliament.player.mandateStartedAt = '2025-06-02';
store.requestGovernmentPost('Innovazione digitale');
state = store.getState();
const mine = state.parliament.government.ministers.find(item => item.playerAppointed);
assert.ok(mine ? state.dataset.offices.some(office => /Ministro · Innovazione digitale/.test(office.title) && !office.endDate) : state.parliament.government.lastPostRequestAt === state.clock.currentDate, 'La richiesta dal gioco apre un incarico o viene respinta con attesa.');

// ---------- 6. leaving the majority: crisis, confidence, fall; then a new Government can be formed ----------
store.setReferenceGovernment(spec);
store.createCareer(draft({ parliamentaryGroupId: 'cam-xix-01', firstName: 'Terza', partyName: 'Terza lista di prova', partyAbbreviation: 'TLP' }), db.parties, db.parliamentaryGroups);
state = store.getState(); state.game.week.ap = 6;
assert.throws(() => store.withdrawGovernmentSupport(), /Presidente del Consiglio/, 'Il gruppo del Presidente del Consiglio non lascia il proprio governo.');
store.setReferenceGovernment(spec);
store.createCareer(draft({ parliamentaryGroupId: 'cam-xix-03', firstName: 'Quarta', partyName: 'Quarta lista di prova', partyAbbreviation: 'QLP' }), db.parties, db.parliamentaryGroups);
state = store.getState(); state.game.week.ap = 6; state.game.resources.politicalCapital = 60;
store.withdrawGovernmentSupport();
assert.equal(store.getState().parliament.government.status, 'crisis', 'Il gruppo esce dalla maggioranza: crisi.');
for (let week = 0; week < 3 && store.getState().parliament.government.status !== 'fallen'; week++) store.advance(7);
state = store.getState();
assert.equal(state.parliament.government.status, 'fallen', 'Senza quei seggi la fiducia non arriva: il governo cade.');
html = renderParliamentPage('governo', state, { secretary: true });
assert.ok(html.includes('Serve un nuovo governo.'), 'Solo ora non c’è un esecutivo: si può formarne uno nuovo.');
state.game.week.ap = 6; state.game.resources.politicalCapital = 60;
store.formGovernment(['cam-xix-01', 'cam-xix-03', 'cam-xix-04', 'senato-xix-gruppo-85', 'senato-xix-gruppo-33', 'senato-xix-gruppo-56']);
store.voteGovernmentConfidence();
assert.ok(playerRoles(store.getState()).primeMinister, 'Il nuovo governo formato dal giocatore lo porta a Palazzo Chigi.');

// ---------- 7. saves of earlier versions and careers outside Parliament ----------
const saved = JSON.parse(JSON.stringify(store.getState()));
saved.parliament.government = null; saved.parliament.pastGovernments = []; saved.parliament.history = saved.parliament.history.filter(entry => !['governo-riferimento', 'governo-proposto', 'fiducia-ottenuta', 'fiducia-negata'].includes(entry.type));
store.loadGame(saved);
store.setReferenceGovernment(spec);
assert.equal(store.getState().parliament.government?.formedBy, 'reference', 'Un vecchio salvataggio senza governo trova il governo in carica.');
const fallen = JSON.parse(JSON.stringify(store.getState()));
fallen.parliament.government = { ...fallen.parliament.government, status: 'fallen', formedBy: 'player', primeMinister: null };
store.loadGame(fallen);
store.setReferenceGovernment(spec);
assert.equal(store.getState().parliament.government.status, 'fallen', 'Un governo caduto nella partita resta caduto: niente governo aggiunto di nascosto.');
store.setReferenceGovernment(spec);
store.createCareer(draft({ initialLevel: 'comunale', parliamentaryGroupId: '', firstName: 'Quinta', partyName: 'Quinta lista di prova', partyAbbreviation: 'QNP' }), db.parties, db.parliamentaryGroups);
assert.equal(store.getState().parliament, null);
store.initializeParliament(db.parliamentaryGroups);
state = store.getState();
assert.equal(state.parliament.government?.formedBy, 'reference', 'Anche fuori dal Parlamento il Paese ha un governo in carica.');
assert.ok(renderParliamentPage('governo', state, {}).includes('Senza un seggio'), 'Chi non ha un seggio lo segue dall’esterno.');

// ---------- 8. the executive keeps acting while the simulated Prime Minister governs ----------
const society = createSociety({ seedText: 'governo-riferimento', date: '2026-09-24', week: 1, homeRegion: 'Lazio', notoriety: 20 });
const run = governmentState => { let current = society; const lines = []; let date = '2026-09-24'; for (let week = 2; week < 30; week++) { date = new Date(Date.parse(`${date}T12:00:00`) + 7 * 86400000).toISOString().slice(0, 10); const out = advanceSociety(current, { date, week, government: governmentState }); current = out.society; lines.push(...out.lines); } return lines; };
assert.ok(run(government).some(line => line.startsWith('Il governo in carica')), 'Il governo in carica (simulato) adotta provvedimenti.');
assert.ok(!run({ ...government, primeMinister: 'player' }).some(line => /adotta un provvedimento/.test(line)), 'Quando guida il giocatore, decide lui.');
// The simulated Prime Minister answers the allies' demands on his own.
const withDemand = { ...engine.createReferenceGovernment({ ...state.parliament, government: null }, spec, '2026-09-24') };
const ally = Object.keys(withDemand.government.partners)[0];
withDemand.government.partners[ally] = { ...withDemand.government.partners[ally], satisfaction: 40, demand: { type: 'ministero', portfolio: 'Cultura', label: 'il ministero Cultura', deadline: '2026-11-30', since: '2026-09-24' } };
const answered = engine.advanceGovernmentWeek(withDemand, '2026-10-01', 0.5, () => 0.1);
assert.ok(answered.history.some(entry => entry.type === 'richiesta-accolta'), 'Le richieste degli alleati vengono gestite dal Presidente del Consiglio simulato.');
assert.equal(await fingerprint(), before, 'I dati reali del governo e dei parlamentari restano intatti.');
console.log('Governo iniziale verificato: maggioranza ricavata dai gruppi dei componenti del governo reale, governo simulato in carica all’avvio con premier simulato e ministri senza nomi, giocatore non membro; mozione di sfiducia dall’opposizione, sostegno del gruppo, richiesta di un ministero con requisiti e rimpasto, uscita dalla maggioranza, crisi, fiducia chiesta dal premier simulato, caduta e nuovo governo del giocatore; migrazione dei vecchi salvataggi, carriere fuori dal Parlamento, esecutivo che continua ad agire, dati reali intatti.');
