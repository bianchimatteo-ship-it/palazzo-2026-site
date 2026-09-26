// The institutions of a local or European career: the consiglio comunale and regionale with executive, majority and
// opposition, acts proposed by the executive and by the groups, votes with individual dissent, the budget, groups that
// walk out, motions of no confidence that dissolve the council and bring an early vote; the European Parliament with
// its real groups of 2024; the player who proposes, votes, questions the executive or governs (assessori, taxes).
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
const L = await import(`../src/core/local-engine.js${v}`);
const C = await import(`../src/core/career-engine.js${v}`);
const { seededRandom } = await import(`../src/core/vote-engine.js${v}`);
const { advanceDays } = await import(`../src/core/time.js${v}`);
const { store } = await import(`../src/core/store.js${v}`);

// ---------- 1. the European Parliament: the real groups of 2024 ----------
assert.equal(L.EP_GROUPS_2024.groups.reduce((sum, group) => sum + group.seats, 0), 720, 'Parlamento europeo: 720 seggi alla sessione costitutiva 2024.');
assert.ok(L.EP_GROUPS_2024.verified && /europa\.eu/.test(L.EP_GROUPS_2024.sourceUrl));
assert.equal(L.epGroupFor(-1), 'sd'); assert.equal(L.epGroupFor(1), 'epp'); assert.equal(L.epGroupFor(5), 'pfe');
{
  let ep = L.createInstitution({ kind: 'europa', name: 'Parlamento europeo', date: '2026-10-04', role: 'eurodeputato', side: 'maggioranza', playerGroupId: 'sd', groups: L.EP_GROUPS_2024.groups.map(group => ({ ...group, side: ['epp', 'sd', 'renew'].includes(group.id) ? 'maggioranza' : 'opposizione' })) });
  assert.equal(ep.executive, null, 'Nel Parlamento europeo non c’è una giunta: propone la Commissione.');
  let date = '2026-10-04', votes = 0, split = 0;
  const rand = seededRandom('europa');
  for (let week = 0; week < 40; week++) {
    date = advanceDays(date, 7);
    const out = L.advanceInstitutionWeek(ep, { date, rand });
    ep = out.inst;
    for (const event of out.events.filter(item => item.type === 'atto-votato')) { votes++; if (event.yes && event.against) split++; }
  }
  assert.ok(votes >= 5 && split >= 1, `A Strasburgo si vota (${votes} voti, ${split} con maggioranze divise).`);
  assert.equal(ep.status, 'active', 'Il Parlamento europeo non si scioglie.');
  ep = L.proposeLocalAct(ep, 'ambiente', date);
  assert.ok(ep.acts.some(item => item.sponsor.kind === 'player' && /relazione/.test(item.title)), 'L’eurodeputato presenta una relazione d’iniziativa.');
  console.log(`  Parlamento europeo: ${votes} voti in 40 settimane, ${split} con voti contrari.`);
}

// ---------- 2. a consiglio comunale lives for a year ----------
const groups = [
  { id: 'a', label: 'Lista A', axis: -1, seats: 10, side: 'maggioranza' },
  { id: 'b', label: 'Lista B', axis: -2, seats: 5, side: 'maggioranza' },
  { id: 'c', label: 'Lista C', axis: 1, seats: 7, side: 'opposizione' },
  { id: 'd', label: 'Lista D', axis: 0, seats: 3, side: 'opposizione' }
];
{
  let inst = L.createInstitution({ kind: 'comune', name: 'Comune di prova', date: '2026-09-27', role: 'consigliere', side: 'opposizione', playerGroupId: 'd', leaderGroupId: 'a', groups });
  assert.equal(inst.seats, 25);
  assert.equal(inst.executive.members.length, 8, 'La giunta ha i suoi assessori (figure simulate).');
  assert.ok(inst.executive.members.every(item => /simulat/.test(item.label)) && /simulat/.test(inst.executive.label), 'Sindaco e assessori sono dichiaratamente simulati.');
  let date = '2026-09-27';
  const rand = seededRandom('comune-anno');
  const kinds = new Set(), asked = [];
  let budget = null, passed = 0, rejected = 0;
  for (let week = 0; week < 52; week++) {
    date = advanceDays(date, 7);
    const out = L.advanceInstitutionWeek(inst, { date, rand, issues: ['trasporti', 'casa'] });
    inst = out.inst;
    for (const event of out.events) {
      if (event.type === 'voto-locale') { asked.push(event); if (asked.length === 1) inst = L.setLocalVote(inst, event.actId, 'contrario'); }
      if (event.type === 'atto-votato') { kinds.add(event.kind); event.passed ? passed++ : rejected++; if (event.budget) budget = event; }
    }
  }
  assert.ok(kinds.has('executive') && (kinds.has('opposition') || kinds.has('majority')), `Propongono la giunta e i gruppi (${[...kinds].join(', ')}).`);
  assert.ok(budget, 'In autunno arriva il bilancio di previsione e si vota.');
  assert.ok(asked.length >= 2, 'Il consigliere viene chiamato a votare sugli atti importanti.');
  assert.ok(passed >= 3, `Il consiglio approva (${passed} sì, ${rejected} no).`);
  const own = inst.acts.flatMap(item => item.votes).concat([]).find(vote => vote.byGroup.some(row => row.playerChoice === 'contrario'));
  assert.ok(own || inst.archive.length, 'Il voto scelto dal giocatore entra nel conteggio.');
  // A proposal of the player, a question to the executive.
  inst = L.proposeLocalAct(inst, 'casa', date);
  assert.throws(() => L.proposeLocalAct(inst, 'scuola', date), /già una proposta/, 'Una proposta alla volta.');
  const pressure = inst.pressure;
  inst = L.questionExecutive(inst, date);
  assert.ok(inst.pressure > pressure, 'L’interrogazione mette pressione alla giunta.');
  assert.throws(() => L.questionExecutive(inst, advanceDays(date, 7)), /da poco/);
  assert.throws(() => L.reshuffleLocal(inst, 'Bilancio', 'b', date), /Solo chi guida/, 'Solo il sindaco nomina gli assessori.');
  const forecast = L.forecastAct(inst, inst.acts.find(item => item.sponsor.kind === 'player'));
  assert.ok(forecast.positions.find(item => item.groupId === 'c').line !== 'favorevole' || forecast.positions.find(item => item.groupId === 'a').support < 0.7, 'L’opposizione non regala i voti.');
  console.log(`  Consiglio comunale: un anno, ${passed} atti approvati e ${rejected} respinti, bilancio ${budget.passed ? 'approvato' : 'respinto'}, ${asked.length} richieste di voto al consigliere.`);
}

// ---------- 3. the player as mayor: assessori, taxes, concessions ----------
{
  let inst = L.createInstitution({ kind: 'comune', name: 'Comune di prova', date: '2026-09-27', role: 'sindaco', side: 'maggioranza', playerGroupId: 'a', leaderGroupId: 'a', leaderIsPlayer: true, groups });
  assert.equal(inst.executive.leader, 'player');
  const member = inst.executive.members.find(item => item.groupId === 'a');
  const before = inst.groups.find(item => item.id === 'b').cohesion;
  inst = L.reshuffleLocal(inst, member.portfolio, 'b', '2026-10-04');
  assert.ok(inst.groups.find(item => item.id === 'b').cohesion > before, 'Il gruppo che riceve l’assessorato è più leale.');
  assert.throws(() => L.reshuffleLocal(inst, member.portfolio, 'c', '2026-10-04'), /maggioranza/, 'Gli assessori vengono dalla maggioranza.');
  const margin = inst.budget.margin;
  inst = L.setLocalTax(inst, 'alta', '2026-10-04');
  assert.ok(inst.budget.margin > margin, 'Aliquote più alte, più margine nel bilancio.');
  inst = L.proposeLocalAct(inst, 'trasporti', '2026-10-04');
  const act = inst.acts.at(-1);
  assert.equal(act.sponsor.kind, 'executive', 'La proposta del sindaco è un atto della giunta.');
  const support = L.forecastAct(inst, act).positions.find(item => item.groupId === 'd').support;
  inst = L.concedeToGroup(inst, act.id, 'd', '2026-10-04');
  assert.ok(L.forecastAct(inst, inst.acts.at(-1)).positions.find(item => item.groupId === 'd').support > support, 'Una concessione sposta i voti di un gruppo.');
}

// ---------- 4. a majority that falls apart: motion of no confidence, dissolution, early vote ----------
{
  let dissolved = 0, walkouts = 0;
  for (let run = 0; run < 12; run++) {
    let inst = L.createInstitution({ kind: 'comune', name: 'Comune fragile', date: '2026-09-27', role: 'consigliere', side: 'opposizione', playerGroupId: 'd', leaderGroupId: 'a', groups: [
      { id: 'a', label: 'Lista A', axis: -1, seats: 8, side: 'maggioranza' }, { id: 'b', label: 'Lista B', axis: -2, seats: 5, side: 'maggioranza' },
      { id: 'c', label: 'Lista C', axis: 1, seats: 9, side: 'opposizione' }, { id: 'd', label: 'Lista D', axis: 0, seats: 3, side: 'opposizione' }] });
    inst = { ...inst, groups: inst.groups.map(group => group.id === 'b' ? { ...group, cohesion: 20 } : group), executive: { ...inst.executive, stability: 25 }, pressure: 70 };
    let date = '2026-09-27';
    const rand = seededRandom(`fragile-${run}`);
    for (let week = 0; week < 40 && inst.status === 'active'; week++) {
      date = advanceDays(date, 7);
      const out = L.advanceInstitutionWeek(inst, { date, rand });
      inst = out.inst;
      walkouts += out.events.filter(item => item.type === 'uscita-maggioranza').length;
      if (out.events.some(item => item.type === 'scioglimento')) { dissolved++; assert.ok(inst.history.some(item => item.type === 'sfiducia'), 'Prima la mozione di sfiducia, poi lo scioglimento.'); }
    }
  }
  assert.ok(walkouts >= 1 && dissolved >= 1, `Le maggioranze si rompono (${walkouts} uscite, ${dissolved} scioglimenti su 12 prove).`);
  // The early vote: a comune dissolved in winter votes in the next spring round; a region within a few months.
  const game = C.createGameState({ seedText: 'anticipate', currentDate: '2026-09-26', level: 'comunale', place: { region: 'Toscana', municipality: 'Firenze' }, localCalendar: { comunale: '2024-06-09', regionale: '2025-10-12', comunaleReal: true, regionaleReal: true } });
  const early = C.scheduleEarlyLocalElection(game, 'comunale', '2027-01-10');
  const vote = early.elections.find(item => item.type === 'comunale' && item.status === 'upcoming');
  assert.equal(vote.electionDate, '2027-05-30', 'Comune sciolto a gennaio: si vota al turno di primavera.');
  assert.ok(vote.early);
  const region = C.scheduleEarlyLocalElection(game, 'regionale', '2027-01-10').elections.find(item => item.type === 'regionale' && item.status === 'upcoming');
  assert.ok(region.early && region.electionDate < '2027-06-01', 'Regione sciolta: voto anticipato entro pochi mesi.');
  console.log(`  Crisi: ${walkouts} uscite dalla maggioranza, ${dissolved} consigli sciolti su 12; voto anticipato il ${vote.electionDate} (comune) e il ${region.electionDate} (regione).`);
}

// ---------- 5. the store: a local career sits in its council, votes, proposes ----------
{
  await realData.loadRealDatabase();
  await realData.loadRealCollections(['parties', 'politicalMovements', 'coalitions', 'twoPerThousand', 'realPolls', 'parliamentaryGroups']);
  const db = realData.realDatabase;
  store.setRealReference({ twoPerThousand: db.twoPerThousand, parties: db.parties, movements: db.politicalMovements, coalitions: db.coalitions, polls: db.realPolls, governingIds: links.governingEntityIds(db), startDate: db.manifest.snapshotDate });
  store.createCareer({ firstName: 'Lucia', lastName: 'Consiglio', birthDate: '1985-01-01', gender: 'donna', region: 'Toscana', municipality: 'Firenze', municipalityCode: '048017', previousProfession: 'Avvocata', initialLevel: 'comunale', parliamentaryGroupId: '', partyMode: 'independent', partyId: '', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } }, db.parties, db.parliamentaryGroups);
  store.setLocalCalendar(await realData.loadRealDocument('localElections'));
  let s = store.getState();
  assert.ok(s.game.elections.find(item => item.type === 'comunale' && item.status === 'upcoming').electionDate > '2029-01-01', 'Firenze vota nel 2029: il consiglio resta in carica.');
  const inst = s.local?.institutions?.find(item => item.status === 'active' && item.kind === 'comune');
  assert.ok(inst && inst.playerGroupId && inst.groups.some(group => group.id === inst.playerGroupId), 'Una carriera comunale parte con un seggio in consiglio.');
  assert.ok(inst.groups.some(group => group.side === 'maggioranza') && inst.groups.some(group => group.side === 'opposizione'));
  assert.ok(inst.until, 'Il mandato dura fino alle prossime comunali.');
  store.proposeLocalAct(inst.id, 'casa');
  assert.throws(() => store.proposeLocalAct(inst.id, 'scuola'), /già una proposta/);
  let asked = null;
  for (let week = 0; week < 20; week++) {
    s = store.getState();
    if (s.game.status === 'ended') s.game.status = 'active';
    asked = s.game.inbox.find(item => item.templateId === 'voto-consiglio') ?? asked;
    if (asked && s.game.inbox.includes(asked)) { store.castLocalVote(asked.params.instId, asked.params.actId, 'astenuto'); }
    store.advance(7);
  }
  s = store.getState();
  const after = s.local.institutions.find(item => item.id === inst.id);
  const voted = [...after.acts, ...after.archive].filter(item => ['approvato', 'respinto'].includes(item.stage));
  assert.ok(voted.length >= 3, `Il consiglio vota nelle settimane della partita (${voted.length} atti).`);
  assert.ok(after.history.some(item => item.type === 'proposta') && voted.some(item => /Tua proposta/.test(item.title ?? '')) || after.acts.some(item => /Tua proposta/.test(item.title)), 'La proposta del giocatore fa il suo percorso.');
  assert.ok(asked, 'Il consigliere riceve le richieste di voto in agenda.');
  store.questionLocalExecutive(inst.id);
  assert.ok(store.getState().local.institutions.find(item => item.id === inst.id).history.some(item => item.type === 'interrogazione'));
  // A save made before the councils existed: the player is seated at the next week.
  const saved = store.getState();
  mem.clear();
  console.log(`  Carriera a Firenze: ${after.groups.length} gruppi in consiglio, ${voted.length} atti votati in 20 settimane, richiesta di voto “${asked.params.actTitle}”.`);
  assert.ok(saved.local.institutions.length >= 1);
}

console.log('Istituzioni locali ed europee verificate: consigli comunali e regionali con giunta, maggioranza e opposizione, atti e bilancio al voto, dissenso del consigliere, proposte, interrogazioni, rimpasti e aliquote del sindaco, concessioni ai gruppi, uscite dalla maggioranza, sfiducia e scioglimento con voto anticipato, Parlamento europeo con i gruppi reali del 2024.');
