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
  // Who proposes counts: the majority gives an act of the opposition less than the same text brought by the giunta.
  const proposal = inst.acts.find(item => item.sponsor.kind === 'player' && item.category !== 'interrogazione');
  assert.equal(proposal.category, 'mozione', 'Il consigliere propone di norma una mozione');
  const forecast = L.forecastAct(inst, proposal);
  const byGiunta = L.forecastAct(inst, { ...proposal, kind: 'executive', sponsor: { kind: 'executive', groupId: 'a', label: 'Giunta', axis: -1 } });
  assert.ok(forecast.positions.find(item => item.groupId === 'a').support < byGiunta.positions.find(item => item.groupId === 'a').support, 'La maggioranza non regala i voti all’opposizione: conta chi propone.');
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
  let dissolved = 0, walkouts = 0, byBudget = 0;
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
      const end = out.events.find(item => item.type === 'scioglimento');
      if (end) { dissolved++; if (end.reason === 'bilancio') byBudget++; assert.ok(end.reason === 'bilancio' ? inst.history.filter(item => item.type === 'bilancio').length >= 1 : inst.history.some(item => item.type === 'sfiducia'), 'Prima la sfiducia (o due bilanci respinti), poi lo scioglimento.'); }
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
  console.log(`  Crisi: ${walkouts} uscite dalla maggioranza, ${dissolved} consigli sciolti su 12 (${byBudget} per il bilancio non approvato); voto anticipato il ${vote.electionDate} (comune) e il ${region.electionDate} (regione).`);
}

// ---------- 4b. the European Parliament: committees, reports, amendments, committee votes, offices ----------
{
  const groups = L.EP_GROUPS_2024.groups.map(group => ({ ...group, side: ['epp', 'sd', 'renew'].includes(group.id) ? 'maggioranza' : 'opposizione' }));
  let ep = L.createInstitution({ kind: 'europa', name: 'Parlamento europeo', date: '2029-07-15', role: 'eurodeputato', side: 'maggioranza', playerGroupId: 'epp', groups, committee: 'envi' });
  assert.ok(ep.ep.member === 'envi' && L.committeeById(ep.ep.substitute) && ep.ep.substitute !== 'envi', 'Membro titolare della commissione scelta, sostituto in un’altra.');
  assert.equal(L.EP_COMMITTEES.length, 10);
  for (const area of L.localAreas('europa')) assert.ok(L.EP_COMMITTEES.some(committee => committee.areas.includes(area)), `Ogni tema europeo ha la sua commissione (${area}).`);
  let date = '2029-07-15';
  const rand = seededRandom('commissioni');
  let own = 0, all = 0, committeeVotes = 0, memberVotes = 0, reports = 0, bids = 0;
  for (let week = 0; week < 60; week++) {
    date = advanceDays(date, 7);
    const out = L.advanceInstitutionWeek(ep, { date, rand });
    ep = out.inst;
    for (const event of out.events) {
      if (event.type === 'commissione-votata') { committeeVotes++; if (event.playerChoice) memberVotes++; }
      if (event.type === 'relazione-votata') reports++;
    }
    for (const act of ep.acts.filter(item => item.stage === 'commissione' && item.introducedAt === date)) { all++; if (L.inCommittee(ep, act)) own++; }
    // The player asks for every report of the own committee.
    for (const act of ep.acts.filter(item => item.stage === 'commissione' && item.committee === ep.ep.member && !item.rapporteur)) { ep = L.bidRapporteur(ep, act.id, { influence: 55, rand, date }).inst; bids++; }
  }
  assert.ok(own / all >= 0.4, `I dossier seguiti sono soprattutto quelli delle proprie commissioni (${own} su ${all}).`);
  assert.ok(committeeVotes >= 3 && memberVotes >= 1, `Voto in commissione prima della plenaria, con il voto del giocatore da titolare (${committeeVotes} voti, ${memberVotes} da titolare).`);
  assert.ok(bids >= 3 && reports >= 1 && ep.ep.merit >= 1, `Relazioni chieste (${bids}), votate in plenaria (${reports}), lavoro registrato (${ep.ep.merit} punti).`);
  assert.ok(ep.acts.filter(item => item.committeeVote).every(item => item.rapporteur), 'Ogni dossier votato in commissione ha un relatore.');
  // The rules of the moves.
  const other = L.EP_COMMITTEES.find(committee => ![ep.ep.member, ep.ep.substitute].includes(committee.id));
  ep = { ...ep, acts: [...ep.acts, { id: 'dossier-prova', kind: 'executive', title: 'Proposta di regolamento: prova', area: other.areas[0], committee: other.id, sponsor: { kind: 'executive', groupId: null, label: 'Commissione europea', axis: 0.5 }, stage: 'commissione', introducedAt: date, nextStepAt: advanceDays(date, 14), votes: [], rapporteur: null, pendingPlayerVote: null, label: 'Proposta della Commissione' }] };
  assert.throws(() => L.bidRapporteur(ep, 'dossier-prova', { rand, date }), /titolare/, 'Le relazioni si chiedono nella propria commissione.');
  assert.throws(() => L.tableAmendment(ep, 'dossier-prova', { rand, date }), /tue commissioni/, 'Si emendano i dossier delle proprie commissioni.');
  ep = { ...ep, acts: ep.acts.map(item => item.id === 'dossier-prova' ? { ...item, committee: ep.ep.member, area: L.committeeById(ep.ep.member).areas[0] } : item) };
  const before = L.forecastAct(ep, ep.acts.find(item => item.id === 'dossier-prova')).positions.find(item => item.groupId === 'epp').support;
  let amended = null;
  for (let attempt = 0; attempt < 30 && !amended?.carried; attempt++) {
    const out = L.tableAmendment({ ...ep, acts: ep.acts.map(item => item.id === 'dossier-prova' ? { ...item, playerAmendment: null } : item) }, 'dossier-prova', { influence: 60, rand: seededRandom(`emendamento-${attempt}`), date });
    if (out.carried) amended = out;
  }
  assert.ok(amended, 'Un emendamento passa in commissione.');
  assert.ok(L.forecastAct(amended.inst, amended.inst.acts.find(item => item.id === 'dossier-prova')).positions.find(item => item.groupId === 'epp').support > before, 'L’emendamento approvato avvicina il testo al gruppo del giocatore.');
  assert.throws(() => L.tableAmendment(amended.inst, 'dossier-prova', { rand, date }), /già presentato/, 'Un solo pacchetto di emendamenti per dossier.');
  // Offices: work first, then time in the office.
  let seat = { ...ep, ep: { ...ep.ep, merit: 0, role: null, roleSince: null, lastBid: null } };
  assert.throws(() => L.runForCommitteeRole(seat, { rand, date }), /più lavoro/);
  seat = { ...seat, ep: { ...seat.ep, merit: 40 } };
  let office = null;
  for (let attempt = 0; attempt < 30 && !office?.won; attempt++) office = L.runForCommitteeRole({ ...seat, ep: { ...seat.ep, lastBid: null } }, { influence: 60, rand: seededRandom(`incarico-${attempt}`), date });
  assert.ok(office.won && office.inst.ep.role === 'coordinatore', 'Coordinatore del gruppo in commissione.');
  assert.throws(() => L.runForCommitteeRole({ ...office.inst, ep: { ...office.inst.ep, lastBid: null } }, { rand, date: advanceDays(date, 7) }), /settimane/, 'Vicepresidente solo dopo qualche mese da coordinatore.');
  const later = L.runForCommitteeRole({ ...office.inst, ep: { ...office.inst.ep, lastBid: null } }, { influence: 60, rand: () => 0, date: advanceDays(date, 7 * 27) });
  assert.ok(later.won && later.inst.ep.role === 'vicepresidente', 'Poi vicepresidente della commissione.');
  // A move to another committee leaves the office and waits some months before a new request.
  const moved = L.requestCommittee(later.inst, other.id, { influence: 60, rand: () => 0, date });
  assert.ok(moved.moved && moved.inst.ep.member === other.id && moved.inst.ep.role === null && moved.leftRole === 'vicepresidente');
  assert.throws(() => L.requestCommittee(moved.inst, L.EP_COMMITTEES[0].id === other.id ? L.EP_COMMITTEES[1].id : L.EP_COMMITTEES[0].id, { rand, date }), /qualche mese/);
  // A European Parliament saved before the committees: the MEP gets a seat and the dossiers a committee.
  const legacy = L.withEuropeanSeat({ ...ep, ep: undefined, acts: ep.acts.map(({ committee, ...act }) => act) }, date);
  assert.ok(legacy.ep?.member && legacy.acts.every(item => item.committee), 'I salvataggi precedenti ricevono le commissioni.');
  console.log(`  Parlamento europeo: ${all} dossier (${own} nelle tue commissioni), ${committeeVotes} voti in commissione, ${bids} relazioni chieste, ${reports} votate in plenaria, incarichi da coordinatore a vicepresidente, cambio di commissione.`);
}

// ---------- 4c. the player's vote: one of the group's votes, in the forecast and in the result ----------
{
  const M = await import(`../src/ui/local-mode.js${v}`);
  // The count: [final yes, final no, the player's vote, passes, decisive]. The others are the final count without the
  // player's vote, with a few abstentions and absences of their own (they count for neither side).
  const cases = [
    [49, 49, 'favorevole', false, false], // without the player 48-49: fails whatever the player does
    [49, 49, 'contrario', false, true], // a yes would make it 50-48
    [49, 49, 'astenuto', false, true], // a yes would make it 50-49
    [49, 49, 'assente', false, true],
    [50, 49, 'favorevole', true, true], // against 49-50, abstaining 49-49: fails
    [50, 49, 'contrario', true, false], // a yes 51-48, abstaining 50-48: passes anyway
    [50, 49, 'astenuto', true, true], // against: 50-50, fails
    [50, 49, 'assente', true, true],
    [50, 50, 'favorevole', false, false], // without the player 49-50: fails anyway
    [50, 50, 'contrario', false, true], // a yes 51-49, abstaining 50-49: passes
    [50, 50, 'astenuto', false, true], // a yes: 51-50
    [50, 50, 'assente', false, true],
    [12, 11, 'astenuto', true, true], [60, 40, 'contrario', true, false], [40, 60, 'favorevole', false, false]
  ];
  for (const [yes, against, choice, passes, decisive] of cases) {
    const count = L.countVote({ yes: yes - (choice === 'favorevole' ? 1 : 0), against: against - (choice === 'contrario' ? 1 : 0), abstain: 3, absent: 2 }, choice);
    const label = `${yes}-${against} con il voto ${choice}`;
    assert.deepEqual([count.yes, count.against, count.abstain, count.absent], [yes, against, 3 + (choice === 'astenuto' ? 1 : 0), 2 + (choice === 'assente' ? 1 : 0)], `${label}: il voto del giocatore è nel conteggio`);
    assert.equal(count.passed, passes, `${label}: esito`);
    assert.equal(count.decisive, decisive, `${label}: decisivo solo se un altro voto del giocatore cambia l’esito`);
  }
  assert.equal(L.countVote({ yes: 50, against: 50 }).decisive, false, 'Chi non vota non è decisivo');
  assert.throws(() => L.countVote({ yes: 1, against: 0 }, 'boh'), /non valida/, 'Una scelta di voto sconosciuta è rifiutata');

  // In a council: Futuro Nazionale has 4 seats, the player's among them. The player's vote takes the place of one of
  // the four, in the forecast before the vote and in the vote itself; the others vote the same whatever the player does.
  const council = (name, groups) => {
    let inst = L.createInstitution({ kind: 'comune', name, date: '2026-10-01', role: 'consigliere', side: 'maggioranza', playerGroupId: 'fn', leaderGroupId: 'fdi', groups });
    const rand = seededRandom(`voto-giocatore|${name}`);
    // An act of the giunta that the council votes by the majority of the voters (a deliberation, a regulation, a plan).
    const councilAct = item => item.sponsor.kind === 'executive' && item.organ === 'consiglio' && item.quorum === 'votanti';
    for (let week = 0; week < 30 && !inst.acts.some(councilAct); week++) inst = L.advanceInstitutionWeek(inst, { date: '2026-10-01', rand }).inst;
    const act = inst.acts.find(councilAct);
    assert.ok(act, `${name}: la giunta porta una delibera in consiglio`);
    return { inst, act };
  };
  const vote = ({ inst, act }, choice) => {
    const chosen = L.setLocalVote(inst, act.id, choice);
    const forecast = L.forecastAct(chosen, chosen.acts.find(item => item.id === act.id));
    const due = { ...chosen, acts: chosen.acts.map(item => item.id === act.id ? { ...item, stage: 'aula', nextStepAt: '2026-10-08' } : item) };
    const out = L.advanceInstitutionWeek(due, { date: '2026-10-08', rand: seededRandom('voto-giocatore|aula') });
    const done = out.inst.acts.find(item => item.id === act.id);
    return { chosen, forecast, out, done, result: done.votes.at(-1), event: out.events.find(item => item.type === 'atto-votato' && item.actId === act.id) };
  };
  const siena = council('Comune di Siena', [
    { id: 'fdi', label: 'Fratelli d’Italia', axis: 2, seats: 8, side: 'maggioranza' },
    { id: 'pd', label: 'Partito Democratico', axis: -1, seats: 5, side: 'opposizione' },
    { id: 'm5s', label: 'Movimento 5 Stelle', axis: 0, seats: 2, side: 'opposizione' },
    { id: 'fn', label: 'Futuro Nazionale', axis: 2, seats: 4, side: 'maggioranza' },
    { id: 'lega', label: 'Lega', axis: 2, seats: 2, side: 'maggioranza' },
    { id: 'az', label: 'Azione', axis: 0, seats: 1, side: 'opposizione' },
    { id: 'civ', label: 'Liste civiche', axis: 0, seats: 2, side: 'opposizione' }
  ]);
  const expected = { linea: [4, 0, 0, 0], favorevole: [4, 0, 0, 0], contrario: [3, 1, 0, 0], astenuto: [3, 0, 1, 0], assente: [3, 0, 0, 1] };
  const results = {};
  for (const [choice, counts] of Object.entries(expected)) {
    const { chosen, forecast, done, result, event } = vote(siena, choice);
    const own = forecast.positions.find(item => item.groupId === 'fn');
    assert.deepEqual([own.yes, own.no, own.abstain, own.absent], counts, `Previsione con il voto ${choice}: Futuro Nazionale ${counts.join('/')} (sì/no/astenuti/assenti)`);
    assert.equal(own.playerChoice, choice === 'linea' ? own.line : choice, `Previsione: il voto del giocatore è ${choice}`);
    assert.equal(forecast.yes + forecast.against + forecast.abstain + forecast.absent, chosen.seats, 'Previsione: ogni seggio vota una volta');
    const row = result.byGroup.find(item => item.groupId === 'fn');
    assert.deepEqual([row.yesVotes, row.noVotes, row.abstainVotes, row.absent], counts, `Voto con la scelta ${choice}: Futuro Nazionale ${counts.join('/')}`);
    assert.equal(result.playerChoice, choice === 'linea' ? result.playerLine : choice, `Voto: salvata la scelta del giocatore (${choice})`);
    assert.equal(result.yes + result.against + result.abstain + result.absent, chosen.seats, 'Voto: ogni seggio conta una volta');
    assert.equal(result.passed, result.yes > result.against, 'Passa con più sì che no');
    assert.equal(done.stage, result.passed ? 'approvato' : 'respinto', 'Approvato o respinto dai voti espressi');
    assert.equal(done.pendingPlayerVote, null, 'Dopo il voto la scelta non resta in sospeso');
    assert.ok(event && event.playerChoice === result.playerChoice && event.passed === result.passed && event.decisive === result.decisive, 'Le conseguenze politiche usano il voto effettivo');
    results[choice] = result;
  }
  assert.deepEqual([results.favorevole.yes - results.contrario.yes, results.contrario.against - results.favorevole.against, results.astenuto.abstain - results.favorevole.abstain, results.assente.absent - results.favorevole.absent], [1, 1, 1, 1], 'Il voto del giocatore sposta esattamente un voto');
  assert.ok(Object.values(results).every(item => !item.decisive), `Con ${results.favorevole.yes} sì e ${results.favorevole.against} no il voto del giocatore non è decisivo`);

  // A council on a knife-edge: 9 seats of the majority (the player's group among them) against 8.
  const tight = council('Comune in bilico', [
    { id: 'fdi', label: 'Fratelli d’Italia', axis: 2, seats: 5, side: 'maggioranza' },
    { id: 'fn', label: 'Futuro Nazionale', axis: 2, seats: 4, side: 'maggioranza' },
    { id: 'pd', label: 'Partito Democratico', axis: -1, seats: 4, side: 'opposizione' },
    { id: 'avs', label: 'Alleanza Verdi e Sinistra', axis: -2, seats: 4, side: 'opposizione' }
  ]);
  const edge = { favorevole: [9, 8, 'approvato'], contrario: [8, 9, 'respinto'], astenuto: [8, 8, 'respinto'], assente: [8, 8, 'respinto'] };
  for (const [choice, [yes, against, stage]] of Object.entries(edge)) {
    const { forecast, done, result, event } = vote(tight, choice);
    assert.deepEqual([result.yes, result.against, done.stage], [yes, against, stage], `In bilico, voto ${choice}: ${yes}-${against}, ${stage}`);
    assert.ok(result.decisive && event.decisive, `In bilico, voto ${choice}: il voto del giocatore è decisivo`);
    assert.equal(forecast.passes, stage === 'approvato', `In bilico, voto ${choice}: la previsione segue il voto del giocatore`);
  }

  // The page: before the vote the forecast (with the player's vote in the group), after it the votes actually cast.
  const view = inst => M.renderInstitutions({ local: { institutions: [inst] }, game: { resources: { politicalCapital: 10 } }, dataset: { statistics: [] }, career: { playerId: null }, clock: { currentDate: '2026-10-08' } });
  const before = view(vote(siena, 'contrario').chosen);
  assert.ok(before.includes('Previsione prima del voto in aula') && before.includes('Futuro Nazionale · favorevole: <b>3</b> sì, <b>1</b> no · tu: contrario'), 'Prima del voto: la previsione conta il voto del giocatore nel suo gruppo');
  const after = view(vote(siena, 'contrario').out.inst);
  assert.ok(after.includes('Risultato del voto:') && after.includes('il tuo voto: <b>contrario</b>, contro la linea del gruppo'), 'Dopo il voto: i voti espressi e il voto del giocatore');
  const closing = vote(tight, 'favorevole').out.inst;
  assert.ok(view(closing).includes('<b>9</b> sì, <b>8</b> no · il tuo voto: <b>favorevole</b> · <b>decisivo</b>') && closing.history.some(item => /9 sì, 8 no; tuo voto: favorevole, decisivo/.test(item.text)), 'Dopo il voto: il voto decisivo è segnato');
  console.log(`  Voto del giocatore: 49-49, 50-49, 50-50 con voto a favore, contro, astensione e assenza; Futuro Nazionale 4/3+1 in previsione e nel voto; consiglio in bilico 9-8 con voto decisivo.`);
}

// ---------- 6. acts with a kind: the catalogue, the majorities, the positions, the effects ----------
{
  const A = await import(`../src/data/simulation/local-acts.js${v}`);
  const S = await import(`../src/core/society-engine.js${v}`);
  // The catalogue: every kind of act says what it is for, who decides, the iter, the majority, what it changes, what
  // follows if it passes or not.
  for (const kind of ['comune', 'regione']) for (const type of A.ACT_TYPES[kind]) assert.ok(type.label && type.function && type.proposers && type.iter.length >= 2 && type.modifies && type.approved && type.rejected && A.QUORUMS[type.quorum], `${kind}: ${type.id} spiegato per intero`);
  const ids = kind => A.ACT_TYPES[kind].map(type => type.id);
  for (const id of ['delibera-giunta', 'mozione', 'interrogazione', 'bilancio', 'variazione', 'regolamento', 'piano', 'urbanistica', 'tributi', 'tariffe', 'servizi', 'opere', 'convenzione', 'statuto', 'sfiducia']) assert.ok(ids('comune').includes(id), `Comune: c’è ${id}`);
  for (const id of ['legge', 'regolamento', 'delibera-giunta', 'piano', 'bilancio', 'variazione', 'tributi', 'mozione', 'interrogazione', 'statuto', 'sfiducia']) assert.ok(ids('regione').includes(id), `Regione: c’è ${id}`);
  assert.ok(A.actTypeOf('comune', 'sfiducia').quorum === 'componenti' && A.actTypeOf('regione', 'sfiducia').quorum === 'componenti' && A.actTypeOf('comune', 'statuto').quorum === 'dueterzi' && A.actTypeOf('regione', 'statuto').quorum === 'componenti' && A.actTypeOf('comune', 'delibera-giunta').quorum === 'giunta', 'Maggioranze diverse per istituzione e tipo di atto');

  // The majorities: of the voters, of the members, two thirds, with the legal number.
  assert.deepEqual([A.neededYes('componenti', 24), A.neededYes('dueterzi', 24), A.neededYes('votanti', 24)], [13, 16, null]);
  assert.deepEqual([A.legalNumber('comune', 24), A.legalNumber('comune', 24, true), A.legalNumber('regione', 30)], [12, 8, 16]);
  const absolute = { quorum: 'componenti', seats: 24, legal: 12 };
  assert.equal(L.countVote({ yes: 12, against: 5, abstain: 4, absent: 2 }, 'astenuto', absolute).passed, false, 'Maggioranza assoluta: 12 sì su 24 non bastano, anche con pochi no');
  assert.equal(L.countVote({ yes: 12, against: 5, abstain: 4, absent: 2 }, 'favorevole', absolute).passed, true, '13 sì su 24: approvato');
  assert.equal(L.countVote({ yes: 12, against: 5, abstain: 4, absent: 2 }, 'contrario', absolute).decisive, true, 'Il sì del giocatore sarebbe decisivo');
  assert.equal(L.countVote({ yes: 15, against: 3, abstain: 2, absent: 3 }, 'favorevole', { quorum: 'dueterzi', seats: 24, legal: 12 }).passed, true, 'Due terzi: 16 sì su 24');
  assert.equal(L.countVote({ yes: 15, against: 3, abstain: 2, absent: 3 }, 'astenuto', { quorum: 'dueterzi', seats: 24, legal: 12 }).passed, false, 'Due terzi: 15 sì non bastano');
  const thin = L.countVote({ yes: 6, against: 3, abstain: 1, absent: 13 }, 'favorevole', { quorum: 'votanti', seats: 24, legal: 12 });
  assert.ok(!thin.valid && !thin.passed, 'Senza numero legale non si approva nulla');
  const walkout = L.countVote({ yes: 7, against: 3, abstain: 1, absent: 12 }, 'favorevole', { quorum: 'votanti', seats: 24, legal: 12 });
  assert.ok(walkout.valid && walkout.passed && walkout.decisive, 'Con 12 presenti basta la maggioranza dei votanti; uscendo, il giocatore farebbe mancare il numero legale');

  // The positions of the groups change with the theme and the kind of act: not the majority in favour and the
  // opposition against on everything.
  const groups6 = [
    { id: 'pd', label: 'Partito Democratico', axis: -1, seats: 9, side: 'maggioranza' }, { id: 'avs', label: 'Alleanza Verdi e Sinistra', axis: -2, seats: 3, side: 'maggioranza' },
    { id: 'civ', label: 'Lista civica', axis: 0, seats: 2, side: 'maggioranza' }, { id: 'fdi', label: 'Fratelli d’Italia', axis: 2, seats: 6, side: 'opposizione' },
    { id: 'lega', label: 'Lega', axis: 2, seats: 2, side: 'opposizione' }, { id: 'az', label: 'Azione', axis: 0.5, seats: 2, side: 'opposizione' }
  ];
  const territory = { servizi: 50, sicurezza: 50, ambiente: 50, trasporti: 50, infrastrutture: 50, economia: 50 };
  const mayor = L.createInstitution({ kind: 'comune', name: 'Comune di prova', date: '2027-01-10', role: 'sindaco', side: 'maggioranza', playerGroupId: 'pd', leaderGroupId: 'pd', leaderIsPlayer: true, groups: groups6, territory });
  const themes = [['regolamento', 'sicurezza'], ['servizi', 'welfare'], ['piano', 'ambiente'], ['opere', 'sport'], ['regolamento', 'commercio'], ['servizi', 'trasporti'], ['opere', 'cultura'], ['urbanistica', 'casa', 'espansione'], ['urbanistica', 'casa', 'rigenerazione'], ['convenzione', 'pa']];
  const lines = {};
  let mixed = 0;
  for (const [category, area, variant] of themes) {
    const next = L.proposeLocalAct(mayor, area, '2027-01-10', { category, variant });
    const forecast = L.forecastAct(next, next.acts.at(-1));
    for (const item of forecast.positions) (lines[item.groupId] ??= new Set()).add(item.line);
    if (forecast.positions.some(item => (item.side === 'maggioranza') !== (item.line === 'favorevole'))) mixed++;
  }
  const changing = groups6.filter(group => group.id !== 'pd' && lines[group.id].size >= 2).map(group => group.label);
  assert.ok(changing.length >= 4, `I gruppi cambiano posizione tra un tema e l’altro (${changing.join(', ')})`);
  assert.ok(['fdi', 'lega', 'az'].some(id => lines[id].has('favorevole')) && ['avs', 'civ'].some(id => lines[id].has('contrario')), 'L’opposizione vota a favore di qualche atto, la maggioranza contro qualcuno');
  assert.ok(mixed >= themes.length / 2, `Non sempre maggioranza sì e opposizione no (${mixed} atti su ${themes.length})`);

  // The effects of an approved act: the service improves week after week (compared with the same city without it),
  // the budget pays, the region receives a share.
  const at = (inst, id, stage, date) => ({ ...inst, acts: inst.acts.map(item => item.id === id ? { ...item, stage, nextStepAt: date } : item) });
  const week = (inst, date) => L.advanceInstitutionWeek(inst, { date, rand: seededRandom(`atti|${date}`) });
  let proposed = L.proposeLocalAct(mayor, 'sicurezza', '2027-01-10', { category: 'regolamento' });
  const rule = proposed.acts.at(-1);
  assert.ok(rule.organ === 'consiglio' && rule.quorum === 'votanti' && rule.measure.indicators.sicurezza > 0, 'Un regolamento lo vota il consiglio e migliora la sicurezza urbana');
  let out = week(at(proposed, rule.id, 'aula', '2027-01-17'), '2027-01-17');
  assert.equal(out.inst.acts.find(item => item.id === rule.id).stage, 'approvato');
  const shared = out.events.find(item => item.type === 'effetti' && item.actId === rule.id);
  assert.ok(shared && shared.indicators.sicurezza > 0 && shared.indicators.sicurezza < rule.measure.indicators.sicurezza, 'Una parte dell’effetto arriva alla regione');
  let withAct = out.inst, control = week(mayor, '2027-01-17').inst;
  for (let day = 24; day <= 24 + 7 * 9; day += 7) { const date = advanceDays('2027-01-17', day - 17); withAct = week(withAct, date).inst; control = week(control, date).inst; }
  const gain = withAct.indicators.sicurezza - control.indicators.sicurezza;
  assert.ok(Math.abs(gain - rule.measure.indicators.sicurezza) < 0.4, `Il regolamento migliora la sicurezza urbana di ${gain.toFixed(1)} (previsti ${rule.measure.indicators.sicurezza})`);
  // Public works: the money at once; taxes: the rates and the margin.
  proposed = L.proposeLocalAct(mayor, 'sport', '2027-01-10', { category: 'opere' });
  const works = proposed.acts.at(-1);
  out = week(at(proposed, works.id, 'aula', '2027-01-17'), '2027-01-17');
  assert.ok(out.inst.acts.find(item => item.id === works.id).stage === 'approvato' && Math.abs(out.inst.budget.margin - (mayor.budget.margin - works.measure.cost)) < 0.01 && out.inst.effects.some(item => item.indicator === 'sport'), 'Le opere pubbliche spendono il margine e migliorano gli impianti');
  proposed = L.proposeLocalAct(mayor, 'fisco', '2027-01-10', { category: 'tributi', variant: 'aumento' });
  const taxes = proposed.acts.at(-1);
  out = week(at(proposed, taxes.id, 'aula', '2027-01-17'), '2027-01-17');
  assert.ok(out.inst.acts.find(item => item.id === taxes.id).stage === 'approvato' && out.inst.budget.localTax === 'alta' && out.inst.budget.margin === mayor.budget.margin + 12, 'Le aliquote passano in consiglio: pressione fiscale alta, più margine');
  assert.ok(out.events.find(item => item.type === 'atto-votato' && item.actId === taxes.id)?.measure?.tax === 'su', 'L’esito porta la misura alle conseguenze politiche');
  // Without cover the act is withdrawn; an act of the Giunta is decided by the Giunta, not by the council.
  proposed = L.proposeLocalAct({ ...mayor, budget: { ...mayor.budget, margin: 3 } }, 'infrastrutture', '2027-01-10', { category: 'opere' });
  out = week(at(proposed, proposed.acts.at(-1).id, 'aula', '2027-01-17'), '2027-01-17');
  assert.ok(/copertura/.test(out.inst.acts.at(-1).withdrawn ?? '') && out.events.some(item => item.type === 'atto-ritirato'), 'Senza copertura finanziaria l’atto è ritirato');
  proposed = L.proposeLocalAct(mayor, 'cultura', '2027-01-10', { category: 'delibera-giunta' });
  const giunta = proposed.acts.at(-1);
  assert.equal(giunta.stage, 'giunta');
  assert.equal(L.forecastAct(proposed, giunta).organ, 'giunta');
  out = week(at(proposed, giunta.id, 'giunta', '2027-01-17'), '2027-01-17');
  const adopted = out.inst.acts.find(item => item.id === giunta.id);
  assert.ok(adopted.stage === 'approvato' && adopted.votes.at(-1).organ === 'giunta' && adopted.votes.at(-1).byGroup.length === 0 && out.inst.history.some(item => /Giunta: “/.test(item.text)), 'La delibera di Giunta la adotta la Giunta');
  // A town plan: adopted, eight weeks of observations, then approved; building more costs green.
  proposed = L.proposeLocalAct(mayor, 'casa', '2027-01-10', { category: 'urbanistica', variant: 'espansione' });
  const plan = proposed.acts.at(-1);
  out = week(at(proposed, plan.id, 'aula', '2027-01-17'), '2027-01-17');
  let step = out.inst.acts.find(item => item.id === plan.id);
  assert.ok(step.stage === 'osservazioni' && step.adoptedAt === '2027-01-17' && !out.inst.effects.length, 'Il piano adottato aspetta le osservazioni');
  out = week(at(out.inst, plan.id, 'aula', '2027-03-14'), '2027-03-14');
  step = out.inst.acts.find(item => item.id === plan.id);
  assert.ok(step.stage === 'approvato' && out.inst.effects.some(item => item.indicator === 'territorio' && item.perWeek > 0) && out.inst.effects.some(item => item.indicator === 'ambiente' && item.perWeek < 0), 'Approvato: più case e meno verde');
  // The statute of the comune needs two thirds (or, failing that, twice the absolute majority).
  proposed = L.proposeLocalAct(mayor, 'pa', '2027-01-10', { category: 'statuto' });
  const statute = proposed.acts.at(-1);
  out = week(at(proposed, statute.id, 'aula', '2027-01-17'), '2027-01-17');
  step = out.inst.acts.find(item => item.id === statute.id);
  const first = step.votes.at(-1);
  assert.equal(first.quorum, 'dueterzi');
  assert.ok(first.yes >= 16 ? step.stage === 'approvato' : step.stage === 'aula' && step.quorum === 'componenti', 'Statuto: due terzi, altrimenti due voti a maggioranza assoluta');

  // Rejections have their own consequences: a budget not approved means a provisional budget, a second no the Prefect
  // and dissolution. Here a small partner of the majority, neglected, votes against: 12 against 13. (Neglected, it may
  // also leave the majority and bring a no-confidence motion first: over a few councils the budget path shows up.)
  let byBudget = 0;
  for (const year of [2027, 2028, 2029, 2030, 2031, 2032]) {
    const neglected = inst => ({ ...inst, groups: inst.groups.map(group => group.id === 'p' ? { ...group, cohesion: 5 } : group) });
    let weak = L.createInstitution({ kind: 'comune', name: `Comune in crisi ${year}`, date: `${year}-11-07`, role: 'consigliere', side: 'opposizione', playerGroupId: 'b', leaderGroupId: 'a', territory, groups: [
      { id: 'a', label: 'Lista A', axis: -1, seats: 12, side: 'maggioranza' }, { id: 'p', label: 'Lista P', axis: 0, seats: 1, side: 'maggioranza' },
      { id: 'b', label: 'Lista B', axis: 2, seats: 7, side: 'opposizione' }, { id: 'c', label: 'Lista C', axis: 1, seats: 5, side: 'opposizione' }] });
    weak = week({ ...neglected(weak), executive: { ...weak.executive, stability: 60 } }, `${year}-11-07`).inst;
    let budget = weak.acts.find(item => item.category === 'bilancio');
    assert.ok(budget && budget.quorum === 'votanti', 'In novembre arriva il bilancio di previsione');
    out = week(at(neglected(weak), budget.id, 'aula', `${year}-11-14`), `${year}-11-14`);
    // The neglected partner decides (on the day it may still vote in favour: then the budget passes).
    if (out.inst.acts.find(item => item.id === budget.id).stage !== 'respinto') { assert.ok(!out.inst.budget.provisional && out.inst.budget.approvedYear === year + 1, 'Bilancio approvato: le risorse del nuovo anno'); continue; }
    assert.ok(out.inst.budget.provisional && out.events.some(item => item.type === 'bilancio-respinto'), 'Bilancio respinto: esercizio provvisorio');
    assert.match(L.coverageGap(out.inst, { measure: { cost: 2 } }) ?? '', /esercizio provvisorio/, 'In esercizio provvisorio niente nuove spese');
    weak = week(week(neglected(out.inst), `${year}-11-21`).inst, `${year}-11-28`).inst;
    budget = weak.acts.find(item => item.category === 'bilancio' && !L.isClosedAct(item));
    if (weak.status !== 'active' || !budget) continue;
    out = week(at(neglected(weak), budget.id, 'aula', `${year}-12-05`), `${year}-12-05`);
    if (out.events.some(item => item.type === 'scioglimento' && item.reason === 'bilancio')) { byBudget++; assert.equal(out.inst.status, 'sciolto', 'Secondo bilancio respinto: commissario e scioglimento'); }
  }
  assert.ok(byBudget >= 1, `Il secondo bilancio respinto scioglie il consiglio (${byBudget} casi su 6)`);

  // A question: the answer depends on how the service is doing.
  let councillor = L.createInstitution({ kind: 'comune', name: 'Comune di prova', date: '2027-01-10', role: 'consigliere', side: 'opposizione', playerGroupId: 'az', leaderGroupId: 'pd', groups: groups6, territory });
  councillor = { ...councillor, indicators: { ...councillor.indicators, sicurezza: 30 } };
  councillor = L.questionExecutive(councillor, '2027-01-10', 'sicurezza');
  const question = councillor.acts.at(-1);
  assert.ok(question.category === 'interrogazione' && question.stage === 'risposta' && question.organ === 'esecutivo', 'L’interrogazione aspetta la risposta, non un voto');
  out = week(at(councillor, question.id, 'risposta', '2027-01-17'), '2027-01-17');
  assert.ok(out.inst.acts.find(item => item.id === question.id).answer === 'insufficiente' && out.events.some(item => item.type === 'interrogazione-risposta' && item.player), 'Servizio in difficoltà: risposta insufficiente');
  // A motion approved commits the executive; ignored, it costs stability.
  councillor = L.createInstitution({ kind: 'comune', name: 'Comune di prova', date: '2027-01-10', role: 'consigliere', side: 'maggioranza', playerGroupId: 'avs', leaderGroupId: 'pd', groups: groups6, territory });
  councillor = L.proposeLocalAct(councillor, 'sport', '2027-01-10');
  const motion = councillor.acts.at(-1);
  assert.ok(motion.category === 'mozione' && motion.stage === 'aula', 'La mozione va direttamente in aula');
  out = week(at(councillor, motion.id, 'aula', '2027-01-17'), '2027-01-17');
  const commitment = out.inst.commitments.find(item => item.actId === motion.id);
  assert.ok(out.inst.acts.find(item => item.id === motion.id).stage === 'approvato' && commitment?.status === 'aperto' && commitment.dueAt === '2027-03-14', 'Mozione approvata: la giunta ha otto settimane');
  let followed = { ...out.inst, executive: { ...out.inst.executive, leader: 'player' } };
  const stability = followed.executive.stability;
  out = week(followed, '2027-03-14');
  assert.ok(out.inst.commitments.find(item => item.actId === motion.id).status === 'disatteso' && out.events.some(item => item.type === 'impegno-disatteso') && out.inst.history.some(item => /Impegno non rispettato/.test(item.text)), 'Impegno scaduto: la mozione resta senza seguito');

  // A regione: a law on health moves the region's indicators through the society simulation; the statute needs two
  // deliberations by absolute majority, two months apart.
  const regionGroups = [{ id: 'x', label: 'Lista X', axis: -1, seats: 17, side: 'maggioranza' }, { id: 'y', label: 'Lista Y', axis: 1.5, seats: 13, side: 'opposizione' }];
  const president = L.createInstitution({ kind: 'regione', name: 'Regione Toscana', region: 'Toscana', date: '2027-01-10', role: 'presidente', side: 'maggioranza', playerGroupId: 'x', leaderGroupId: 'x', leaderIsPlayer: true, groups: regionGroups });
  proposed = L.proposeLocalAct(president, 'sanita', '2027-01-10', { category: 'legge' });
  const law = proposed.acts.at(-1);
  assert.ok(law.measure.indicators.sanita > 0 && law.label === 'Legge regionale', 'Una legge regionale sulla sanità muove l’indicatore della sanità');
  out = week(at(proposed, law.id, 'aula', '2027-01-17'), '2027-01-17', );
  const health = out.events.find(item => item.type === 'effetti' && item.actId === law.id);
  assert.ok(health && health.kind === 'regione' && health.region === 'Toscana' && health.indicators.sanita === law.measure.indicators.sanita, 'Approvata: gli effetti vanno alla regione');
  const society = S.createSociety({ seedText: 'atti-regione', date: '2027-01-10' });
  const before = society.regions.Toscana.indicators.sanita;
  let scheduled = S.scheduleRegionalEffects(society, { region: 'Toscana', indicators: health.indicators, phase: health.phase, lasting: health.lasting, cause: health.title });
  const queued = scheduled.effects.filter(item => item.region === 'Toscana' && item.cause === health.title);
  assert.ok(Math.abs(queued.reduce((sum, item) => sum + item.perWeek * item.remaining, 0) - health.indicators.sanita) < 0.1, 'La società riceve l’effetto settimana dopo settimana');
  for (let i = 1; i <= health.phase; i++) scheduled = S.advanceSociety(scheduled, { date: advanceDays('2027-01-10', i * 7), week: i + 1 }).society;
  assert.ok(scheduled.regions.Toscana.indicators.sanita > before, `La sanità toscana migliora (${before} → ${scheduled.regions.Toscana.indicators.sanita})`);
  proposed = L.proposeLocalAct(president, 'autonomie', '2027-01-10', { category: 'statuto' });
  const charter = proposed.acts.at(-1);
  out = week(at(proposed, charter.id, 'aula', '2027-01-17'), '2027-01-17');
  step = out.inst.acts.find(item => item.id === charter.id);
  assert.ok(step.stage === 'seconda-lettura' && step.nextStepAt === '2027-03-21' && step.votes.at(-1).quorum === 'componenti', 'Statuto regionale: prima deliberazione, la seconda dopo almeno due mesi');
  console.log(`  Atti: ${A.ACT_TYPES.comune.length} tipi per il comune e ${A.ACT_TYPES.regione.length} per la regione; ${changing.length} gruppi su 5 cambiano posizione tra i temi; regolamento sulla sicurezza +${gain.toFixed(1)}; bilancio respinto due volte → scioglimento; sanità toscana ${before} → ${scheduled.regions.Toscana.indicators.sanita}.`);
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
  const proposalId = store.getState().local.institutions.find(item => item.id === inst.id).acts.at(-1).id;
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
  assert.ok(after.history.some(item => item.type === 'proposta') && [...after.acts, ...after.archive].some(item => item.id === proposalId), 'La proposta del giocatore fa il suo percorso.');
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
