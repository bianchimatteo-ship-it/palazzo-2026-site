// The Chambers at work without the player: bills of the Government (ddl, decrees, the budget), of the groups of the
// majority and of the opposition and of the committees, their calendar (committee, hearings, amendments, obstruction,
// floor, other Chamber, lapses), the positions of the groups, the question of confidence; the player who speaks, amends
// and votes on the bills of the others (with dissent and its consequences); individual dissent in the votes; who gets
// the credit for a law; the national Parliament of a career outside it; saves that stay light. Several careers.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
// The same module instances the game uses (every import carries the build version of index.html).
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const realData = await import(`../src/data/repositories/real-data.js${v}`);
const links = await import(`../src/data/repositories/party-links.js${v}`);
const govRef = await import(`../src/data/repositories/government-reference.js${v}`);
await realData.loadRealDatabase();
await realData.loadRealCollections(['parties', 'politicalMovements', 'coalitions', 'twoPerThousand', 'realPolls']);
await realData.loadRealCollections(['government', 'politicians', 'politicalFigures', 'parliamentaryGroups', 'committees', ...links.PARTY_LINK_COLLECTIONS]);
const db = realData.realDatabase;
const LM = await import(`../src/core/lawmaking-engine.js${v}`);
const P = await import(`../src/core/parliament-engine.js${v}`);
const VE = await import(`../src/core/vote-engine.js${v}`);
const { renderParliamentPage } = await import(`../src/ui/parliament-mode.js${v}`);
const { store } = await import(`../src/core/store.js${v}`);
const reference = (governingIds = []) => ({ twoPerThousand: db.twoPerThousand ?? [], parties: db.parties ?? [], movements: db.politicalMovements ?? [], coalitions: db.coalitions ?? [], polls: db.realPolls ?? [], governingIds, startDate: db.manifest?.snapshotDate ?? null });
store.setRealReference(reference(links.governingEntityIds()));
store.setReferenceGovernment(govRef.referenceGovernmentSpec());
store.setParliamentaryGroups(db.parliamentaryGroups);
const clean = (html, where) => { const bad = html.replace(/data-[a-z-]+="[^"]*"/g, '').match(/.{0,60}(undefined|NaN|\[object Object\]).{0,60}/); assert.ok(!bad, `${where}: valori non validi (${bad?.[0]})`); };
const CLOSED = ['approved', 'rejected', 'lapsed'];
const draft = (level, groupId, name) => ({ firstName: name, lastName: 'Prova', birthDate: '1981-05-05', gender: 'donna', region: 'Toscana', municipality: 'Firenze', previousProfession: 'Avvocata', initialLevel: level, parliamentaryGroupId: groupId, parliamentStartMode: 'real-context', partyMode: 'independent', partyId: '', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } });
const keepAlive = () => { const s = store.getState(); if (s.game.status === 'ended') { s.game.status = 'active'; s.game.endReason = null; } for (const item of s.dataset.statistics) if (item.subjectId === s.career.playerId && item.metric === 'reputation' && item.value < 30) item.value = 30; };
const allBills = s => [...s.parliament.laws.filter(law => law.auto), ...(s.parliament.lawArchive ?? [])];

// ---------- 1. the engine ----------
{
  store.createCareer(draft('deputato', 'cam-xix-02', 'Motore'), db.parties, db.parliamentaryGroups);
  store.initializeParliament(db.parliamentaryGroups);
  const s = store.getState();
  const linked = LM.linkGroupsToParties(s.parliament, s.world);
  const group = id => ['camera', 'senato'].flatMap(chamber => linked.chambers[chamber].groups).find(item => item.groupId === id);
  const fdi = s.world.parties.find(party => /fratelli d.italia/i.test(party.label));
  assert.equal(group('cam-xix-01').partyId, fdi.id, 'Il gruppo Fratelli d’Italia è legato alla sua forza nel mondo del gioco.');
  assert.equal(group('cam-xix-10').partyId, null, 'Il Misto non ha un partito.');
  assert.ok(group('cam-xix-01').axis > 0 && group('cam-xix-02').axis < 0, 'Ogni gruppo prende la collocazione della sua forza.');
  assert.equal(group('cam-xix-01').reference.source, 'real', 'Il riferimento reale del gruppo resta intatto.');
  // Profiles follow the collocazione and are the same for the groups of a party in both Chambers.
  assert.deepEqual(P.groupProfile(group('cam-xix-01')).likes, P.groupProfile(group('senato-xix-gruppo-85')).likes, 'Stesso partito, stesse priorità nelle due Camere.');
  assert.ok(P.groupProfile(group('cam-xix-01')).likes.every(id => ['sicurezza', 'immigrazione', 'fisco', 'famiglia', 'difesa', 'autonomie', 'industria', 'giustizia', 'demografia', 'energia'].includes(id)), 'Un gruppo di destra ha priorità di destra.');
  // Positions: a Government bill is backed by the majority and opposed by the opposition.
  const parliament = linked;
  const bill = { id: 'prova-governo', title: 'Prova', kind: 'ddl', stage: 'amendments', currentChamber: 'camera', auto: true, sponsor: { kind: 'governo', groupId: parliament.government.premierGroupId, partyId: group(parliament.government.premierGroupId)?.partyId ?? null, label: 'Il governo' }, policy: { area: 'economia', instrument: 'riforma', intensity: 1, financing: 'evasione', target: 'nazionale', segment: 'tutti' }, votes: [], demands: {}, compromiseLevel: 0 };
  const governing = P.governingGroupIds(parliament);
  assert.ok(governing.size >= 4, 'All’avvio c’è il governo in carica con la sua maggioranza.');
  const premierAxis = group(parliament.government.premierGroupId)?.axis ?? 0;
  for (const row of parliament.chambers.camera.groups.filter(item => item.partyId)) {
    const support = LM.groupSupport(parliament, bill, row, { world: s.world });
    if (governing.has(row.groupId)) assert.ok(support > 0.5, `${row.officialName} (maggioranza) sostiene il ddl del governo: ${support}`);
    // A force of the opposition far from the Government votes against; a close one may be tempted.
    else if (Math.abs(row.axis - premierAxis) >= 2) assert.ok(support < 0.5, `${row.officialName} (opposizione) non lo sostiene: ${support}`);
  }
  const forecast = LM.forecastVote(parliament, bill, { world: s.world });
  assert.ok(forecast.passes && forecast.positions.length === parliament.chambers.camera.groups.length, 'La maggioranza ha i numeri per il suo ddl.');
  // The player's own vote: against the line of the group, recorded and visible seat by seat.
  const withBill = { ...parliament, laws: [bill] };
  const vote = LM.autoVote(withBill, bill, 'camera', { date: s.clock.currentDate, world: s.world, playerChoice: 'favorevole' });
  const own = vote.byGroup.find(row => row.groupId === 'cam-xix-02');
  assert.equal(own.playerChoice, 'favorevole', 'Il voto del giocatore è registrato nel suo gruppo.');
  assert.equal(vote.playerLine, 'contrario', 'La linea del PD sul ddl del governo è contraria.');
  assert.equal(vote.yes, vote.byGroup.reduce((sum, row) => sum + row.yesVotes, 0));
  const summary = VE.voteSummary(vote);
  const roster = [...Array.from({ length: own.simulatedSeats - 1 }, (_, index) => ({ groupId: 'cam-xix-02', person: null, player: false, placeholder: true, placeholderIndex: index + 1 })), { groupId: 'cam-xix-02', person: null, player: true, placeholder: false }];
  const seats = VE.individualVotes({ ...summary, groups: summary.groups.filter(row => row.groupId === 'cam-xix-02') }, roster);
  assert.equal(seats.choices.at(-1), 'favorevole', 'Nell’emiciclo il seggio del giocatore vota come ha deciso.');
  assert.ok(seats.dissenters.some(item => item.player), 'Il giocatore risulta tra i dissidenti del suo gruppo.');
  // The usual dissenters: those least tied to the line break it more often than the others.
  const others = seats.dissenters.filter(item => !item.player);
  if (others.length >= 2) {
    const mean = list => list.reduce((sum, item) => sum + VE.independenceOf(roster[item.index]), 0) / list.length;
    const everyone = roster.filter(seat => !seat.player).map(seat => ({ index: roster.indexOf(seat) }));
    assert.ok(mean(others) >= mean(everyone) - 0.02, 'I dissidenti sono soprattutto i parlamentari meno legati alla linea.');
  }
  const absent = LM.autoVote(withBill, bill, 'camera', { date: s.clock.currentDate, world: s.world, playerChoice: 'assente' });
  assert.equal(absent.byGroup.find(row => row.groupId === 'cam-xix-02').yesVotes + absent.byGroup.find(row => row.groupId === 'cam-xix-02').noVotes + absent.byGroup.find(row => row.groupId === 'cam-xix-02').abstainVotes, own.simulatedSeats - 1, 'Chi non partecipa al voto non è contato.');
  assert.throws(() => LM.setPlayerVote(withBill, 'prova-governo', 'forse'), /non valida/);
  assert.throws(() => LM.setPlayerVote({ ...withBill, laws: [{ ...bill, currentChamber: 'senato' }] }, 'prova-governo', 'contrario'), /Senato/, 'Si vota solo nella propria Camera.');
  assert.ok(LM.amendmentOdds(withBill, bill, { influence: 50 }) > 0 && LM.amendmentOdds(withBill, { ...bill, confidence: true }) === 0, 'Sulla fiducia niente emendamenti.');
  // With the Chambers at work, a Government in office acts through its bills and decrees: no automatic measures.
  const SE = await import(`../src/core/society-engine.js${v}`);
  let society = s.society;
  const base = society.week ?? 1;
  for (let week = 1; week <= 14; week++) society = SE.advanceSociety(society, { date: s.clock.currentDate, week: base + week, government: parliament.government, legislates: true }).society;
  assert.equal(society.executive.measures?.length ?? 0, s.society.executive.measures?.length ?? 0, 'Il governo in carica agisce con leggi e decreti, non con provvedimenti automatici.');
  let alone = s.society;
  for (let week = 1; week <= 14; week++) alone = SE.advanceSociety(alone, { date: s.clock.currentDate, week: base + week, government: null, legislates: true }).society;
  assert.ok((alone.executive.measures?.length ?? 0) > (s.society.executive.measures?.length ?? 0), 'Senza un governo in carica l’esecutivo di scenario continua ad agire.');
  console.log('  Motore: gruppi reali legati ai partiti, posizioni, voto del giocatore, dissensi individuali.');
}

// ---------- 2. careers: the calendar of the Chambers ----------
const outcomes = [];
for (const [index, [level, groupId, name]] of [['deputato', 'cam-xix-01', 'Maggioranza'], ['deputato', 'cam-xix-02', 'Opposizione'], ['senatore', 'senato-xix-gruppo-71', 'Senatrice']].entries()) {
  store.createCareer(draft(level, groupId, name), db.parties, db.parliamentaryGroups);
  store.initializeParliament(db.parliamentaryGroups);
  const start = store.getState();
  let asked = 0, dissent = 0, voted = 0;
  let firstLawId = null;
  const choices = [];
  for (let week = 0; week < 46; week++) {
    keepAlive();
    const s = store.getState();
    for (const item of [...s.game.inbox]) {
      if (item.templateId !== 'voto-aula') continue;
      asked += 1;
      const law = s.parliament.laws.find(entry => entry.id === item.params.lawId);
      assert.ok(law?.auto && item.params.lineLabel && item.params.forecast && !/undefined|NaN/.test(item.title + item.body), 'La decisione di voto spiega proposta, linea del gruppo e previsione.');
      // First vote against the line, then with the group.
      const choice = asked === 1 ? (item.params.lineShort === 'a favore' ? 'contrario' : 'favorevole') : 'linea';
      if (asked === 1) firstLawId = law.id;
      choices.push(choice);
      store.resolveAgendaItem(item.id, choice);
      assert.equal(store.getState().parliament.laws.find(entry => entry.id === law.id).pendingPlayerVote, choice, 'La scelta dell’agenda diventa il voto del giocatore.');
    }
    store.advance(7);
  }
  const s = store.getState();
  const bills = allBills(s);
  const kinds = new Set(bills.map(law => law.sponsor?.kind));
  for (const kind of ['governo', 'maggioranza', 'opposizione']) assert.ok(kinds.has(kind), `${name}: anche ${kind} presenta proposte.`);
  assert.ok(bills.some(law => law.kind === 'manovra'), `${name}: in autunno il governo presenta la legge di bilancio.`);
  const budget = bills.find(law => law.kind === 'manovra');
  assert.ok(budget.stage === 'approved' || s.clock.currentDate <= `${budget.budgetYear - 1}-12-31` || s.parliament.government?.status !== 'active', `${name}: la legge di bilancio è approvata entro il 31 dicembre (${budget.stage}).`);
  const closed = kind => bills.filter(law => law.sponsor?.kind === kind && CLOSED.includes(law.stage));
  const rate = kind => closed(kind).length ? closed(kind).filter(law => law.stage === 'approved').length / closed(kind).length : 0;
  assert.ok(rate('governo') > rate('opposizione'), `${name}: il governo fa approvare più leggi dell’opposizione (${rate('governo').toFixed(2)} contro ${rate('opposizione').toFixed(2)}).`);
  assert.ok(bills.some(law => law.stage === 'approved') && bills.some(law => ['rejected', 'lapsed'].includes(law.stage)), `${name}: alcune proposte passano, altre no.`);
  assert.ok(s.parliament.history.some(entry => entry.details?.auto && entry.type === 'iter-approved'), `${name}: le approvazioni sono nel calendario delle Camere.`);
  assert.ok(bills.every(law => law.source === 'simulation' && !/undefined|NaN/.test(law.title + (law.summary ?? ''))), 'Proposte simulate, testi completi.');
  // The player's votes.
  assert.ok(asked >= 1, `${name}: almeno una volta il giocatore è chiamato a votare una proposta di altri.`);
  const recorded = bills.flatMap(law => (law.votes ?? []).filter(vote => vote.playerChoice)).length;
  voted = recorded;
  dissent = (s.game.memory ?? []).filter(item => item.kind === 'dissenso').length;
  const first = [...s.parliament.laws, ...(s.parliament.lawArchive ?? [])].find(law => law.id === firstLawId);
  const firstVote = first?.votes?.find(vote => vote.playerChoice && vote.playerChoice === choices[0]);
  if (firstVote && firstVote.playerLine && firstVote.playerChoice !== firstVote.playerLine) assert.ok(dissent >= 1, `${name}: il voto in dissenso resta nella memoria politica.`);
  // Who answers for the laws: the opposition does not take the credit of the Government's laws.
  if (name === 'Opposizione') {
    const credited = (s.game.memory ?? []).filter(item => item.kind === 'legge');
    assert.equal(credited.length, 0, 'Chi è all’opposizione non si intesta le leggi del governo e degli altri gruppi.');
    assert.ok(!(s.game.timeline ?? []).some(item => /^(Camera|Senato): (approvazione definitiva|primo sì|bocciatura) per/.test(item.title ?? '')), 'La cronologia della carriera non si riempie delle leggi degli altri.');
    assert.ok((s.world.effects ?? []).some(effect => /^Approvata la legge/.test(effect.label ?? '')) || (s.world.events ?? []).length, 'Le leggi approvate danno visibilità ai partiti che le hanno proposte.');
  }
  assert.ok(!(s.career.parliamentHistory ?? []).some(entry => entry.details?.auto), 'Lo storico della carriera resta quello del giocatore.');
  // The page.
  const html = renderParliamentPage('leggi', s, { committees: db.committees, lawFilter: 'tutte' });
  clean(html, `Leggi (${name})`);
  for (const text of ['Scrivi una proposta.', 'Le proposte di governo, gruppi e commissioni', 'data-view-filter="leggi"', 'bill-steps']) assert.ok(html.includes(text), `Leggi (${name}): manca ${text}`);
  if (s.parliament.laws.some(law => law.auto && ['commission', 'amendments', 'final-vote'].includes(law.stage))) assert.ok(html.includes('PREVISIONE IN AULA'), `Leggi (${name}): manca la previsione del voto.`);
  const governo = renderParliamentPage('leggi', s, { committees: db.committees, lawFilter: 'governo' });
  clean(governo, 'Leggi · filtro governo');
  outcomes.push({ name, bills: bills.length, approved: bills.filter(law => law.stage === 'approved').length, asked, voted, dissent, size: JSON.stringify(s).length });
}
for (const item of outcomes) console.log(`  ${item.name}: ${item.bills} proposte (${item.approved} approvate), ${item.asked} voti chiesti, ${item.voted} votati, ${item.dissent} dissensi, salvataggio ${Math.round(item.size / 1024)} KB.`);

// ---------- 3. the player acts on a bill of the others ----------
{
  store.createCareer(draft('deputato', 'cam-xix-02', 'Emendamenti'), db.parties, db.parliamentaryGroups);
  store.initializeParliament(db.parliamentaryGroups);
  let target = null;
  for (let week = 0; week < 30 && !target; week++) {
    keepAlive();
    store.advance(7);
    const s = store.getState();
    target = s.parliament.laws.find(law => law.auto && law.kind === 'ddl' && ['commission', 'amendments'].includes(law.stage) && law.currentChamber === 'camera' && law.sponsor?.groupId !== 'cam-xix-02');
  }
  assert.ok(target, 'Arriva in commissione una proposta di altri nella Camera del giocatore.');
  const s = store.getState();
  s.game.week.ap = 6; s.game.resources.politicalCapital = 30;
  const relation = s.parliament.relations[target.sponsor.groupId]?.value ?? 50;
  store.speakOnLaw(target.id, 'favorevole');
  let law = store.getState().parliament.laws.find(item => item.id === target.id);
  assert.equal(law.playerStance, 'favorevole');
  if (target.sponsor.groupId) assert.ok(store.getState().parliament.relations[target.sponsor.groupId].value > relation, 'Intervenire a favore avvicina il gruppo proponente.');
  assert.throws(() => store.speakOnLaw(target.id, 'favorevole'), /già/);
  const capital = store.getState().game.resources.politicalCapital;
  const result = store.amendOthersLaw(target.id, 'segment', 'giovani');
  law = store.getState().parliament.laws.find(item => item.id === target.id);
  assert.equal(law.playerAmendments.length, 1, 'L’emendamento è registrato, approvato o respinto.');
  assert.equal(result.accepted, law.playerAmendments[0].accepted);
  if (result.accepted) assert.equal(law.policy.segment, 'giovani', 'Un emendamento approvato cambia il testo.');
  assert.ok(store.getState().game.resources.politicalCapital <= capital - 2, 'Un emendamento costa capitale politico.');
  assert.throws(() => store.advanceLaw(target.id, 'vote'), /proposta di altri/, 'L’iter delle proposte altrui non si forza.');
  // A deal: the player's vote in favour in exchange for an amendment raises the odds.
  assert.ok(store.amendmentOdds(target.id, { offerVote: true }) > store.amendmentOdds(target.id), 'Offrire il proprio voto rende l’emendamento più probabile.');
  const deal = store.amendOthersLaw(target.id, 'intensity', 1, { offerVote: true });
  law = store.getState().parliament.laws.find(item => item.id === target.id);
  if (deal.accepted) assert.ok(law.playerDeal && law.pendingPlayerVote === 'favorevole', 'Con l’accordo il voto del giocatore diventa favorevole.');
  assert.throws(() => store.amendOthersLaw(target.id, 'segment', 'imprese'), /due emendamenti/, 'Al massimo due emendamenti per testo in ogni Camera.');
  store.castLawVote(target.id, 'astenuto');
  assert.equal(store.getState().parliament.laws.find(item => item.id === target.id).pendingPlayerVote, 'astenuto');
  let votedRow = null;
  for (let week = 0; week < 12 && !votedRow; week++) {
    keepAlive();
    for (const item of [...store.getState().game.inbox]) if (item.templateId === 'voto-aula' && item.params.lawId !== target.id) store.resolveAgendaItem(item.id, 'linea');
    const pending = store.getState().game.inbox.find(item => item.templateId === 'voto-aula' && item.params.lawId === target.id);
    if (pending) store.resolveAgendaItem(pending.id, 'astenuto');
    store.advance(7);
    const current = store.getState().parliament.laws.find(item => item.id === target.id) ?? null;
    votedRow = current?.votes?.find(vote => vote.chamber === 'camera' && vote.playerChoice)?.byGroup.find(row => row.groupId === 'cam-xix-02') ?? null;
    if (current && CLOSED.includes(current.stage) && !votedRow) break;
  }
  if (votedRow) assert.equal(votedRow.playerChoice, 'astenuto', 'In Aula il giocatore si astiene come deciso.');
  if (votedRow && deal.accepted) assert.ok((store.getState().game.memory ?? []).some(item => item.kind === 'alleato-tradito' && /Accordo non rispettato/.test(item.text)), 'Un accordo non rispettato resta nella memoria.');
  console.log(`  Proposta altrui: intervento, emendamento ${result.accepted ? 'approvato' : 'respinto'} (probabilità ${Math.round(result.chance * 100)}%), accordo sul voto ${deal.accepted ? 'fatto' : 'rifiutato'} (${Math.round(deal.chance * 100)}%)${votedRow ? ', astensione in Aula' : ''}.`);
}

// ---------- 4. a career outside Parliament ----------
{
  store.createCareer({ ...draft('comunale', '', 'Sindaca'), parliamentaryGroupId: '' }, db.parties, db.parliamentaryGroups);
  assert.equal(store.getState().parliament, null, 'Alla creazione la carriera locale non ha un seggio.');
  for (let week = 0; week < 20; week++) { keepAlive(); store.advance(7); }
  const s = store.getState();
  assert.ok(s.parliament?.chambers?.camera?.groups?.length && !s.parliament.player, 'Il Parlamento nazionale lavora anche per chi non ci siede.');
  assert.equal(s.parliament.government?.formedBy, 'reference', 'Con il governo in carica all’avvio.');
  assert.ok(allBills(s).length >= 3, 'Governo e gruppi legiferano anche senza il giocatore.');
  assert.ok(!s.game.inbox.some(item => item.templateId === 'voto-aula'), 'Senza seggio nessuna richiesta di voto.');
  const html = renderParliamentPage('leggi', s, { committees: db.committees });
  clean(html, 'Leggi senza seggio');
  assert.ok(html.includes('Senza un seggio le segui dall’esterno') && !html.includes('data-bill-vote'), 'Senza seggio le proposte si seguono, non si votano.');
}

// ---------- 5. saves stay light ----------
{
  store.createCareer(draft('deputato', 'cam-xix-03', 'Lunga'), db.parties, db.parliamentaryGroups);
  store.initializeParliament(db.parliamentaryGroups);
  for (let week = 0; week < 110; week++) { keepAlive(); store.advance(7); }
  const s = store.getState();
  const closed = s.parliament.laws.filter(law => law.auto && CLOSED.includes(law.stage)).length;
  assert.ok(closed <= LM.LEGISLATIVE_RULES.keepClosed, 'Le proposte concluse da tempo passano all’archivio.');
  assert.ok((s.parliament.lawArchive ?? []).length > 0 && s.parliament.lawArchive.every(item => item.title && item.stage), 'L’archivio conserva titolo ed esito.');
  assert.ok(s.parliament.history.filter(entry => entry.details?.auto).length <= LM.LEGISLATIVE_RULES.autoHistory);
  assert.ok((s.parliament.pastGovernments ?? []).every(item => (item.confidenceVotes ?? []).every(entry => entry.votes.every(vote => !vote.byGroup))), 'I governi passati conservano l’esito delle fiducie, non il dettaglio seggio per seggio.');
  assert.ok(s.dataset.events.length <= 240, 'Gli eventi passati non crescono senza limiti.');
  const size = JSON.stringify(s).length;
  assert.ok(size < 1500 * 1024, `Dopo due anni il salvataggio resta leggero (${Math.round(size / 1024)} KB).`);
  const saved = JSON.parse(JSON.stringify(s));
  store.loadGame(saved);
  assert.equal(store.getState().parliament.laws.filter(law => law.auto).length, s.parliament.laws.filter(law => law.auto).length, 'Il salvataggio ricaricato conserva le proposte.');
  store.advance(7);
  console.log(`  Due anni: salvataggio ${Math.round(size / 1024)} KB, ${s.parliament.lawArchive.length} proposte in archivio.`);
}

console.log('Leggi e Parlamento verificati: governo, maggioranza, opposizione e commissioni legiferano da soli; il giocatore interviene, emenda e vota anche le proposte degli altri, con dissensi individuali e conseguenze.');
