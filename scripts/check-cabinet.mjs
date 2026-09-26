// Governments that live and fall: majorities chosen among several alternatives (external support, grand coalition,
// Government of the President) when no coalition wins by right; consultations after a fall also in the legislature in
// office at the start; the simulated Prime Minister who sets a programme, reshuffles, replaces ministers, looks for
// support, holds a verifica or resigns; allies who break away; the player's personal vote on confidence votes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const realData = await import(`../src/data/repositories/real-data.js${v}`);
const links = await import(`../src/data/repositories/party-links.js${v}`);
const govRef = await import(`../src/data/repositories/government-reference.js${v}`);
await realData.loadRealDatabase();
await realData.loadRealCollections(['parties', 'politicalMovements', 'coalitions', 'twoPerThousand', 'realPolls']);
await realData.loadRealCollections(['government', 'politicians', 'politicalFigures', 'parliamentaryGroups', ...links.PARTY_LINK_COLLECTIONS]);
const db = realData.realDatabase;
const L = await import(`../src/core/legislature-engine.js${v}`);
const P = await import(`../src/core/parliament-engine.js${v}`);
const LM = await import(`../src/core/lawmaking-engine.js${v}`);
const CB = await import(`../src/core/cabinet-engine.js${v}`);
const VE = await import(`../src/core/vote-engine.js${v}`);
const { renderParliamentPage } = await import(`../src/ui/parliament-mode.js${v}`);
const { store } = await import(`../src/core/store.js${v}`);
const reference = (governingIds = []) => ({ twoPerThousand: db.twoPerThousand ?? [], parties: db.parties ?? [], movements: db.politicalMovements ?? [], coalitions: db.coalitions ?? [], polls: db.realPolls ?? [], governingIds, startDate: db.manifest?.snapshotDate ?? null });
store.setRealReference(reference(links.governingEntityIds()));
store.setReferenceGovernment(govRef.referenceGovernmentSpec());
store.setParliamentaryGroups(db.parliamentaryGroups);
const clean = (html, where) => { const bad = html.replace(/data-[a-z-]+="[^"]*"/g, '').match(/.{0,60}(undefined|NaN|\[object Object\]).{0,60}/); assert.ok(!bad, `${where}: valori non validi (${bad?.[0]})`); };
const draft = (groupId, name) => ({ firstName: name, lastName: 'Governo', birthDate: '1979-04-04', gender: 'donna', region: 'Lazio', municipality: 'Roma', previousProfession: 'Giurista', initialLevel: 'deputato', parliamentaryGroupId: groupId, parliamentStartMode: 'real-context', partyMode: 'independent', partyId: '', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } });
const keepAlive = () => { const s = store.getState(); if (s.game.status === 'ended') { s.game.status = 'active'; s.game.endReason = null; } for (const item of s.dataset.statistics) if (item.subjectId === s.career.playerId && item.metric === 'reputation' && item.value < 30) item.value = 30; };
const fresh = (groupId, name) => { store.createCareer(draft(groupId, name), db.parties, db.parliamentaryGroups); store.initializeParliament(db.parliamentaryGroups); const s = store.getState(); return { s, parliament: LM.linkGroupsToParties(s.parliament, s.world) }; };

// ---------- 1. the Chambers as a result, majorities among alternatives ----------
const { s: start, parliament: real } = fresh('cam-xix-02', 'Maggioranze');
const seats = L.seatResult(real, { date: start.clock.currentDate });
const linkedSeats = chamber => real.chambers[chamber].groups.filter(group => group.partyId).reduce((sum, group) => sum + group.simulatedSeats, 0);
for (const chamber of ['camera', 'senato']) assert.equal(seats[chamber].parties.reduce((sum, row) => sum + row.seats, 0), linkedSeats(chamber), `${chamber}: i seggi di ogni forza sono quelli dei suoi gruppi.`);
assert.ok(seats.winner === null && seats.source === 'simulation', 'Le Camere lette come esito: nessun vincitore per diritto.');
const found = new Map();
for (let seed = 1; seed <= 40; seed++) {
  const majority = L.majorityAfterVote(real, seats, start.world, { crisis: true, rand: VE.seededRandom(`crisi-${seed}`) });
  assert.ok(majority, 'Nelle Camere reali una maggioranza si trova sempre.');
  const ids = new Set(majority.groupIds);
  for (const chamber of ['camera', 'senato']) {
    const total = real.chambers[chamber].groups.reduce((sum, group) => sum + group.simulatedSeats, 0);
    assert.ok(real.chambers[chamber].groups.filter(group => ids.has(group.groupId)).reduce((sum, group) => sum + group.simulatedSeats, 0) >= Math.floor(total / 2) + 1, `${majority.label}: ha i numeri alla ${chamber === 'camera' ? 'Camera' : 'Senato'}.`);
  }
  assert.ok(['coalizione-post-voto', 'grande-coalizione', 'governo-del-presidente'].includes(majority.kind) && majority.chance > 0 && majority.chance <= 1);
  found.set(`${majority.kind}|${majority.leaderId}|${[...majority.partyIds].sort().join(',')}|${[...(majority.supportPartyIds ?? [])].sort().join(',')}`, majority);
}
assert.ok(found.size >= 2, `Una crisi non finisce sempre con la stessa maggioranza (${found.size} esiti diversi su 40).`);
const deterministic = L.majorityAfterVote(real, seats, start.world, { crisis: true });
assert.ok(deterministic && deterministic.chance === Math.max(...[...found.values()].map(item => item.chance)), 'Senza estrazione vince l’ipotesi più probabile.');
// External support: the forces far from the leader vote the confidence without ministers.
const supported = [...found.values()].find(item => item.supportPartyIds?.length) ?? { ...deterministic, supportPartyIds: [], groupIds: deterministic.groupIds };
const withSupport = L.electedGovernment(real, { majority: supported, number: 19, date: start.clock.currentDate, leaderLabel: 'Prova' });
const supportGroups = new Set(withSupport.government.supportingGroupIds);
assert.ok(withSupport.government.ministers.every(item => !supportGroups.has(item.groupId)), 'Chi dà un sostegno esterno non ha ministri.');
assert.ok(withSupport.government.coalitionGroupIds.every(id => !supportGroups.has(id)));
console.log(`  Maggioranze possibili nella XIX: ${found.size} esiti diversi (${[...new Set([...found.values()].map(item => item.kind))].join(', ')}).`);

// ---------- 2. the Prime Minister as an actor ----------
{
  const government = real.government;
  assert.equal(government.formedBy, 'reference');
  const date = start.clock.currentDate;
  const zero = () => 0;
  // A sequence of draws, then nothing happens by chance.
  const draws = (...values) => () => values.length ? values.shift() : 0.99;
  // Programme at the start.
  let out = CB.advanceCabinetWeek(real, { date, rand: () => 0.99, world: start.world, society: start.society });
  assert.ok(out.parliament.government.program?.line && out.parliament.government.program.priorities.length >= 2, 'Il governo si dà un programma.');
  assert.ok(out.parliament.history.at(-1)?.type === 'programma-governo');
  // An unhappy ally gets a ministry in a reshuffle.
  const premierParty = P.parliamentInternals.getGroup(real, government.premierGroupId)?.partyId;
  const ally = Object.keys(government.partners).find(id => government.coalitionGroupIds.includes(id) && P.parliamentInternals.getGroup(real, id)?.partyId && P.parliamentInternals.getGroup(real, id).partyId !== premierParty);
  const unhappy = { ...real, government: { ...government, program: { line: 'crescita', priorities: ['economia', 'lavoro'], setAt: date }, partners: { ...government.partners, [ally]: { ...government.partners[ally], satisfaction: 20, demand: null } }, inheritedAt: '2020-01-01', formedAt: '2020-01-01' } };
  const heldBefore = P.activeMinisters(unhappy.government).filter(item => item.groupId === ally).length;
  out = CB.advanceCabinetWeek(unhappy, { date, rand: draws(0), world: start.world, society: start.society });
  assert.ok(out.parliament.history.some(entry => entry.type === 'rimpasto'), 'Un alleato scontento ottiene un ministero con un rimpasto.');
  assert.equal(out.parliament.government.status, 'active', 'Dopo il rimpasto il governo resta in carica.');
  assert.equal(P.activeMinisters(out.parliament.government).filter(item => item.groupId === ally).length, heldBefore + 1);
  // Thin numbers: the Government looks for external support.
  const thin = { ...unhappy, government: { ...unhappy.government, partners: government.partners, lastReshuffleAt: date, coalitionGroupIds: unhappy.government.coalitionGroupIds.filter(id => id !== ally) } };
  const candidates = CB.supportCandidates(thin, start.world);
  assert.ok(candidates.length && candidates.every(item => item.chance > 0 && item.chance <= 0.8), 'Ci sono forze a cui chiedere un sostegno esterno.');
  if (CB.majorityMargin(thin) < CB.CABINET_RULES.thinMargin) {
    out = CB.advanceCabinetWeek(thin, { date, rand: zero, world: start.world, society: start.society });
    assert.ok(out.parliament.government.supportingGroupIds.length > thin.government.supportingGroupIds.length && out.parliament.history.some(entry => entry.type === 'sostegno-esterno'), 'Con numeri stretti arriva un sostegno esterno.');
  }
  // The player's party is asked, when the player leads it: the decision is the player's.
  const target = candidates[0];
  const playerGroup = P.parliamentInternals.allGroups(thin).find(group => group.partyId === target.partyId && group.chamber === 'camera');
  if (playerGroup && CB.majorityMargin(thin) < CB.CABINET_RULES.thinMargin) {
    const asked = CB.advanceCabinetWeek({ ...thin, player: { ...thin.player, chamber: 'camera', groupId: playerGroup.groupId } }, { date, rand: zero, world: start.world, society: start.society, playerSecretaryOf: target.partyId });
    assert.ok(asked.events.some(event => event.id === 'richiesta-sostegno' && event.params.partyId === target.partyId), 'Al segretario del partito arriva la richiesta di sostegno.');
    assert.ok(!asked.parliament.history.some(entry => entry.type === 'sostegno-esterno' && entry.details?.partyId === target.partyId), '…e il partito non entra in maggioranza senza la sua decisione.');
  }
  // A crisis with the numbers: a verifica lowers the risk of defections.
  const crisis = { ...unhappy, government: { ...unhappy.government, partners: government.partners, status: 'crisis', crisisSeverity: 14, crisisOpenedAt: date } };
  out = CB.advanceCabinetWeek(crisis, { date, rand: () => 0.5, world: start.world, society: start.society });
  assert.ok(out.parliament.history.some(entry => entry.type === 'verifica-maggioranza') && out.parliament.government.crisisSeverity < 14, 'In crisi, con i numeri, il governo fa una verifica di maggioranza.');
  // A crisis without the numbers: the Prime Minister can resign.
  const lost = { ...crisis, government: { ...crisis.government, coalitionGroupIds: [crisis.government.premierGroupId], supportingGroupIds: [] } };
  out = CB.advanceCabinetWeek(lost, { date, rand: zero, world: start.world, society: start.society });
  assert.ok(out.parliament.government.status === 'fallen' && out.parliament.government.resigned && out.parliament.history.some(entry => entry.type === 'dimissioni-governo'), 'Senza maggioranza il governo si dimette.');
  // An ally breaks with the Government.
  const tired = { ...unhappy, government: { ...unhappy.government, partners: { ...government.partners, [ally]: { ...government.partners[ally], satisfaction: 5, demand: null } }, lastReshuffleAt: date } };
  out = CB.advanceCabinetWeek(tired, { date, rand: zero, world: start.world, society: start.society });
  assert.ok(['crisis', 'fallen'].includes(out.parliament.government.status) && !out.parliament.government.coalitionGroupIds.includes(ally) && out.parliament.government.leftGroupIds.includes(ally) && out.parliament.history.some(entry => entry.type === 'cambio-maggioranza' && entry.details?.groupId === ally), 'Un alleato scontento rompe ed esce dalla maggioranza: si apre la crisi.');
  console.log('  Governo simulato: programma, rimpasto, sostegno esterno, verifica, dimissioni, strappo.');
}

// ---------- 3. the store: a crisis in the legislature in office, the player's vote on confidence ----------
{
  store.createCareer(draft('cam-xix-01', 'Fiducia'), db.parties, db.parliamentaryGroups);
  store.initializeParliament(db.parliamentaryGroups);
  for (let week = 0; week < 3; week++) { keepAlive(); store.advance(7); }
  let s = store.getState();
  assert.ok(s.parliament.government.program, 'Il governo in carica ha un programma.');
  let html = renderParliamentPage('governo', s, { secretary: false });
  clean(html, 'Governo');
  assert.ok(html.includes('PROGRAMMA') && html.includes('VITA DEL GOVERNO'), 'La scheda del governo mostra programma e vita del governo.');
  // A crisis: the player (in the majority) is asked how to vote on confidence, and votes against.
  s.parliament.government.status = 'crisis';
  s.parliament.government.crisisOpenedAt = s.clock.currentDate;
  s.parliament.government.crisisSeverity = 4;
  s.parliament.government.verificaFor = s.clock.currentDate;
  keepAlive(); store.advance(7);
  s = store.getState();
  const request = s.game.inbox.find(item => item.templateId === 'voto-fiducia');
  assert.ok(request && /Fiducia al/.test(request.title) && request.params.line === 'a favore', 'In crisi arriva la decisione sul voto di fiducia.');
  html = renderParliamentPage('governo', s, { secretary: false });
  assert.ok(html.includes('data-confidence-vote="contrario"'), 'Il voto sulla fiducia si decide anche dalla scheda del governo.');
  const partyBefore = s.parliament.careerStanding.partySupport;
  store.resolveAgendaItem(request.id, 'contrario');
  assert.equal(store.getState().parliament.government.pendingPlayerVote, 'contrario');
  let entry = null;
  for (let week = 0; week < 4 && !entry; week++) {
    keepAlive(); store.advance(7);
    entry = store.getState().parliament.history.find(item => ['fiducia-ottenuta', 'fiducia-negata'].includes(item.type) && item.details?.decided);
  }
  assert.ok(entry, 'Il governo torna alle Camere e si vota la fiducia.');
  assert.equal(entry.details.playerChoice, 'contrario', 'Il giocatore vota contro il governo che il suo gruppo sostiene.');
  s = store.getState();
  const vote = s.parliament.government?.confidenceVotes?.at(-1) ?? s.parliament.pastGovernments?.at(-1)?.confidenceVotes?.at(-1);
  assert.ok((s.game.memory ?? []).some(item => item.kind === 'dissenso' && /Fiducia al/.test(item.text)), 'Il voto contro la fiducia resta nella memoria politica.');
  assert.ok(s.parliament.careerStanding.partySupport < partyBefore, 'Il gruppo non perdona un voto contro la fiducia.');
  // A fall in the legislature in office at the start: consultations, not only early elections.
  s.parliament.government.status = 'fallen';
  s.parliament.government.fallenAt = s.clock.currentDate;
  s.parliament.government.ministers = s.parliament.government.ministers.map(item => ({ ...item, endedAt: item.endedAt ?? s.clock.currentDate }));
  let formed = false, dissolved = false;
  for (let week = 0; week < 8 && !formed && !dissolved; week++) {
    keepAlive();
    for (const item of [...store.getState().game.inbox]) if (item.templateId === 'voto-fiducia') store.resolveAgendaItem(item.id, 'linea');
    store.advance(7);
    const n = store.getState().national;
    formed = n.formation?.phase === 'completata';
    dissolved = n.formation?.phase === 'fallita';
  }
  s = store.getState();
  assert.ok(s.national.history.some(item => item.kind === 'crisi'), 'La caduta apre le consultazioni anche nella XIX legislatura.');
  assert.ok(s.national.formation?.seatResult?.kind === 'aula', 'Le consultazioni partono dai seggi delle forze nelle Camere di oggi.');
  assert.ok(formed || dissolved, 'Le consultazioni finiscono con un nuovo governo o con lo scioglimento.');
  if (formed) {
    assert.ok(['active', 'crisis'].includes(s.parliament.government.status) && s.parliament.government.id !== 'governo-riferimento' && (s.parliament.pastGovernments ?? []).some(item => item.formedBy === 'reference'), 'Nasce un nuovo governo; quello di partenza entra nella storia.');
    assert.ok(/Presidente del Consiglio \(simulato\)|tecnico \(simulato\)/.test(s.parliament.government.premierLabel ?? ''), 'Il nuovo Presidente del Consiglio è una figura simulata.');
  }
  html = renderParliamentPage('governo', s, { secretary: false, national: s.national });
  clean(html, 'Governo dopo la crisi');
  console.log(`  Crisi nella XIX: ${formed ? `nasce ${s.parliament.government.name}` : 'Camere sciolte'}; voto contro la fiducia registrato (${entry.type}).`);
}

console.log('Governi verificati: maggioranze non automatiche, sostegni esterni, rimpasti, verifiche, strappi, dimissioni, consultazioni anche nella legislatura in carica e voto personale sulla fiducia.');
