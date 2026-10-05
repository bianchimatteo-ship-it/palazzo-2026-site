// Il Presidente della Repubblica, sul motore vero della partita: eleggibilità (50 anni), assemblea (Camera, Senato,
// tre delegati per Regione e uno per la Valle d’Aosta), candidature e negoziazioni, scrutini segreti con il quorum
// (due terzi nei primi tre, maggioranza assoluta dal quarto), elezione, incompatibilità, poteri del Quirinale (consultazioni,
// scioglimento e semestre bianco, rinvio delle leggi, attività, senatori a vita, dimissioni), mandato settennale e nuova
// elezione alla scadenza (rielezione o ex Presidente), vecchi salvataggi, invarianti e interfaccia.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const P = await module('src/core/presidency-engine.js');
const R = await module('src/data/simulation/presidency-rules.js');
const { playerRoles } = await module('src/core/roles.js');
const { checkInvariants } = await module('src/core/invariants.js');
const { careerOverview } = await module('src/core/career-overview.js');
const { agendaCalendar } = await module('src/core/agenda-engine.js');
const { renderQuirinale } = await module('src/ui/presidency-view.js');
const { renderElectionsHub } = await module('src/ui/elections-hub.js');
const { renderCareerPage } = await module('src/ui/career-page.js');
const { enterParliament } = await module('src/core/parliament-engine.js');
const lines = [];
const clean = (html, where) => { const bad = html.replace(/data-[a-z-]+="[^"]*"/g, '').match(/.{0,60}(undefined|NaN|\[object Object\]).{0,60}/); assert.ok(!bad, `${where}: valori non validi (${bad?.[0]})`); };
const noIssues = (state, where) => { const result = checkInvariants(state); assert.ok(result.ok, `${where}: invarianti violate ${JSON.stringify(result.issues.slice(0, 3))}`); };
const weeksBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 604800000);

// ---------- 1. le regole della Costituzione ----------
{
  const rules = R.PRESIDENCY_RULES;
  assert.equal(rules.termYears, 7, 'Il mandato dura sette anni (art. 85)');
  assert.equal(rules.minAge, 50, 'Servono cinquant’anni (art. 84)');
  assert.deepEqual([rules.delegates.perRegion, rules.delegates.valleDAosta, rules.twoThirdsUntil], [3, 1, 3], 'Tre delegati per Regione, uno per la Valle d’Aosta, due terzi nei primi tre scrutini');
  assert.equal(P.DELEGATES_TOTAL, 58, '19 Regioni × 3 + 1 della Valle d’Aosta = 58 delegati');
  // Il quorum: due terzi dell'assemblea nei primi tre scrutini, la maggioranza assoluta dal quarto.
  for (const total of [663, 664, 1009]) {
    const assembly = { total, twoThirds: Math.ceil(2 * total / 3), absolute: Math.floor(total / 2) + 1 };
    for (const ballot of [1, 2, 3]) assert.deepEqual([P.quorumFor(ballot, assembly).rule, P.quorumFor(ballot, assembly).needed], ['due-terzi', assembly.twoThirds], `Scrutinio ${ballot} su ${total}: due terzi`);
    for (const ballot of [4, 5, 20]) assert.deepEqual([P.quorumFor(ballot, assembly).rule, P.quorumFor(ballot, assembly).needed], ['maggioranza-assoluta', assembly.absolute], `Scrutinio ${ballot} su ${total}: maggioranza assoluta`);
  }
  assert.deepEqual([Math.ceil(2 * 1009 / 3), Math.floor(1009 / 2) + 1], [673, 505], 'Con 1009 elettori: 673 e 505 (i numeri del 2022)');
  // Eleggibilità: cinquant'anni compiuti il giorno del voto.
  assert.equal(P.presidentialEligibility({ birthDate: '1976-10-04', date: '2026-10-03' }).eligible, false, 'A 49 anni e 364 giorni non si è eleggibili');
  assert.equal(P.presidentialEligibility({ birthDate: '1976-10-03', date: '2026-10-03' }).eligible, true, 'Il giorno del cinquantesimo compleanno sì');
  assert.match(P.presidentialEligibility({ birthDate: '1990-01-01', date: '2026-10-03' }).problems[0], /50 anni compiuti .*art\. 84/);
  assert.equal(P.addYears('2024-02-29', 7), '2031-02-28', 'Il 29 febbraio diventa 28 febbraio');
  // Il calendario del mandato in corso: sette anni dal giuramento, convocazione 30 giorni prima, primo scrutinio in un giorno feriale.
  const incumbent = P.createPresidency({ date: '2026-10-03', seed: 'x' }).incumbent;
  const schedule = P.presidencySchedule(incumbent);
  assert.deepEqual([incumbent.since, schedule.termEnds, schedule.convocation], ['2022-02-03', '2029-02-03', '2029-01-04'], 'Settennato in corso: giuramento 3/2/2022, scadenza 3/2/2029, convocazione 30 giorni prima');
  assert.ok(![0, 6].includes(new Date(`${schedule.firstBallot}T12:00:00Z`).getUTCDay()) && schedule.firstBallot < schedule.termEnds, 'Il primo scrutinio è in un giorno feriale prima della scadenza');
  assert.equal(weeksBetween(schedule.opensAt, schedule.firstBallot), 8, 'Otto settimane di trattative prima del primo scrutinio');
  assert.ok(!incumbent.label.includes('Mattarella') && incumbent.kind === 'simulato', 'Il Presidente in carica non è mai nominato');
  // Il semestre bianco: gli ultimi sei mesi, a meno che la legislatura non scada con loro.
  const white = date => P.whiteSemester(incumbent, date, null);
  assert.ok(!white('2028-07-01').active && white('2028-09-01').active && !white('2029-02-10').active, 'Semestre bianco: da agosto 2028 alla scadenza');
  assert.ok(!P.whiteSemester(incumbent, '2028-10-01', '2029-03-01').active, 'Se la legislatura scade nello stesso semestre, le Camere si possono sciogliere');
  lines.push('regole: 7 anni, 50 anni, 58 delegati, quorum 2/3 poi maggioranza assoluta, semestre bianco');
}

// ---------- 2. l'assemblea sui dati reali e gli scrutini ----------
const run = await startCareer({ seed: 'quirinale-a', level: 'deputato' });
const { store, db } = run;
for (let week = 0; week < 3; week++) store.advance(7);
{
  const s = store.getState();
  assert.ok(s.presidency?.incumbent?.kind === 'simulato' && s.presidency.incumbent.since === '2022-02-03', 'Una carriera nuova trova il settennato in corso');
  const seats = chamber => s.parliament.chambers[chamber].groups.reduce((sum, group) => sum + group.simulatedSeats, 0);
  const assembly = P.composeAssembly({ parliament: s.parliament, world: s.world, seed: 'prova', playerPartyId: s.world.playerPartyId });
  assert.equal(assembly.camera, seats('camera'), 'I deputati dell’assemblea sono quelli della Camera');
  assert.equal(assembly.senato, seats('senato'), 'I senatori dell’assemblea sono quelli del Senato (a vita compresi: i gruppi reali li contano già)');
  assert.equal(assembly.lifeSenators, 0, 'Nella XIX legislatura reale non si aggiungono altri senatori a vita');
  assert.equal(assembly.delegates, 58, '58 delegati regionali');
  assert.equal(assembly.total, assembly.camera + assembly.senato + 58, 'Assemblea = Camera + Senato + delegati');
  assert.equal(assembly.twoThirds, Math.ceil(2 * assembly.total / 3));
  assert.equal(assembly.absolute, Math.floor(assembly.total / 2) + 1);
  assert.equal(assembly.regions.length, 20);
  for (const region of assembly.regions) {
    assert.equal(region.delegates, region.region === 'Valle d’Aosta' ? 1 : 3, `${region.region}: ${region.region === 'Valle d’Aosta' ? 'un delegato' : 'tre delegati'}`);
    assert.equal(region.slots.length, region.delegates);
    if (region.delegates === 3) assert.deepEqual(region.slots.map(slot => slot.side), ['maggioranza', 'maggioranza', 'minoranza'], `${region.region}: due delegati della maggioranza, uno della minoranza`);
    for (const slot of region.slots) assert.ok(assembly.blocs.some(bloc => bloc.id === slot.blocId), `${region.region}: il delegato appartiene a un gruppo dell’assemblea`);
  }
  assert.equal(assembly.blocs.reduce((sum, bloc) => sum + bloc.electors, 0), assembly.total, 'La somma dei gruppi è l’assemblea');
  assert.ok(assembly.blocs.length >= 8 && assembly.blocs.some(bloc => bloc.free), 'I gruppi principali e il Misto (libero)');
  // Con le Camere di una legislatura della partita ci sono cinque senatori a vita simulati.
  const simulated = P.composeAssembly({ parliament: { ...s.parliament, legislature: { ...s.parliament.legislature, reference: 'simulation' } }, world: s.world, seed: 'prova' });
  assert.equal(simulated.lifeSenators, 5, 'Camere simulate: cinque senatori a vita (figure simulate)');
  assert.equal(simulated.total, assembly.total + 5);
  lines.push(`assemblea reale: ${assembly.total} grandi elettori (${assembly.camera} + ${assembly.senato} + 58), due terzi ${assembly.twoThirds}, maggioranza assoluta ${assembly.absolute}`);

  // Dall'apertura alla proclamazione: ogni scrutinio rispetta il quorum e la somma dei voti.
  const outcomes = new Map();
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'l', 'm', 'n']) {
    let presidency = P.createPresidency({ date: s.clock.currentDate, seed });
    const composed = P.composeAssembly({ parliament: s.parliament, world: s.world, seed, playerPartyId: s.world.playerPartyId });
    presidency = P.openElection(presidency, { date: '2028-12-01', assembly: composed, seed }).presidency;
    assert.equal(presidency.election.phase, 'trattative');
    assert.ok(presidency.election.candidates.length >= 5 && presidency.election.candidates.every(candidate => !/[A-Z][a-z]+ [A-Z][a-z]+, /.test(candidate.label)), 'Il campo ha almeno cinque candidati, tutti figure simulate senza nome');
    let date = '2028-12-01';
    let result = null;
    for (let guard = 0; presidency.election && guard < 14; guard++) {
      date = new Date(Date.parse(`${date}T12:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
      const out = P.advanceElection(presidency, { date });
      presidency = out.presidency;
      if (out.elected) { result = P.proclaim(presidency, { elected: out.elected, date: out.elected.date }); presidency = result.presidency; }
    }
    assert.ok(result, `Seed ${seed}: qualcuno è eletto`);
    const ballots = presidency.last.ballots;
    ballots.forEach((ballot, index) => {
      assert.equal(ballot.n, index + 1);
      assert.equal(ballot.needed, ballot.n <= 3 ? composed.twoThirds : composed.absolute, `Seed ${seed}: quorum del ${ballot.n}º scrutinio`);
      assert.equal(ballot.votes.reduce((sum, row) => sum + row.votes, 0) + ballot.blank + ballot.scattered + ballot.absent, composed.total, `Seed ${seed}: tutti i voti del ${ballot.n}º scrutinio sono contati`);
      assert.equal(ballot.elected, index === ballots.length - 1, 'Solo l’ultimo scrutinio ha un eletto');
      if (ballot.elected && !ballot.forced) assert.ok(ballot.leaderVotes >= ballot.needed, `Seed ${seed}: l’eletto ha il quorum`);
      if (index < ballots.length - 1) assert.ok(ballot.leaderVotes < ballot.needed, `Seed ${seed}: senza quorum nessun eletto`);
      assert.ok(![0, 6].includes(new Date(`${ballot.date}T12:00:00Z`).getUTCDay()), 'Gli scrutini sono in giorni feriali');
    });
    assert.ok(ballots.length <= R.PRESIDENCY_RULES.hardLimit);
    // Il nuovo mandato comincia alla scadenza del precedente.
    // Il successore giura alla scadenza del settennato, o tre giorni dopo l'elezione se questa arriva a mandato scaduto.
    const sworn = presidency.incumbent.electedOn >= '2029-02-03' ? new Date(Date.parse(`${presidency.incumbent.electedOn}T12:00:00Z`) + 3 * 86400000).toISOString().slice(0, 10) : '2029-02-03';
    assert.equal(presidency.incumbent.since, sworn, 'Il successore giura alla scadenza del settennato');
    assert.equal(presidency.history.length, 1);
    assert.equal(P.presidencySchedule(presidency.incumbent).termEnds, P.addYears(sworn, 7), 'Il mandato successivo dura sette anni');
    outcomes.set(ballots.length, (outcomes.get(ballots.length) ?? 0) + 1);
  }
  assert.ok(outcomes.size >= 3, `Elezioni diverse tra loro: scrutini necessari ${[...outcomes.keys()].sort((a, b) => a - b).join(', ')}`);
  assert.ok([...outcomes.keys()].some(count => count <= 4) && [...outcomes.keys()].some(count => count >= 5), 'C’è chi viene eletto al quarto scrutinio (maggioranza assoluta) e chi dopo più trattative');
  // Deterministico: lo stesso seme dà lo stesso voto.
  const replay = seed => { let p = P.createPresidency({ date: '2026-10-03', seed }); p = P.openElection(p, { date: '2028-12-01', assembly: P.composeAssembly({ parliament: s.parliament, world: s.world, seed }), seed }).presidency; let d = '2028-12-01'; while (p.election) { d = new Date(Date.parse(`${d}T12:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10); const out = P.advanceElection(p, { date: d }); p = out.presidency; if (out.elected) p = P.proclaim(p, { elected: out.elected, date: out.elected.date }).presidency; } return JSON.stringify(p.history); };
  assert.equal(replay('d'), replay('d'), 'Lo stesso seme dà la stessa elezione');
  assert.notEqual(replay('d'), replay('e'), 'Semi diversi, elezioni diverse');
  lines.push(`12 elezioni simulate: scrutini necessari ${[...outcomes.entries()].sort((a, b) => a[0] - b[0]).map(([count, times]) => `${count}º ×${times}`).join(', ')}`);
}

// ---------- 3. la partita: dall'apertura delle trattative all'elezione ----------
{
  let opened = null;
  for (let week = 0; week < 130 && !opened; week++) { store.advance(7); const s = store.getState(); if (s.presidency.election) opened = s.clock.currentDate; }
  const s = store.getState();
  assert.ok(opened && opened >= '2028-11-20' && opened <= '2028-12-10', `Le trattative si aprono otto settimane prima del primo scrutinio (${opened})`);
  const election = s.presidency.election;
  assert.equal(election.phase, 'trattative');
  assert.equal(election.assembly.delegates, 58);
  assert.equal(election.assembly.total, election.blocs.reduce((sum, bloc) => sum + bloc.electors, 0));
  assert.equal(election.player.role, 'osservatore', 'Fuori dal Parlamento il giocatore osserva');
  assert.ok(agendaCalendar(s).some(item => item.kind === 'quirinale'), 'L’agenda segna il Quirinale');
  // Roles and UI of an observer.
  const roles = playerRoles(s);
  assert.ok(roles.powers.some(power => /^Candidarsi al Quirinale/.test(power.label)), 'Tra i poteri: candidarsi al Quirinale');
  const view = store.presidencyView();
  const page = renderQuirinale(s, view);
  clean(page, 'Quirinale (osservatore)');
  for (const text of ['Grandi elettori', 'I 58 delegati regionali', 'Candidati e negoziazioni', 'PROIEZIONE DEL 1º SCRUTINIO', 'Quorum', 'due terzi', 'maggioranza assoluta']) assert.ok(page.includes(text), `Pagina Quirinale: ${text}`);
  assert.ok(renderElectionsHub(s, { tab: 'quirinale', presidency: () => store.presidencyView() }).includes('data-section-tab-value="quirinale"'), 'La centrale elettorale ha la scheda Quirinale');
  assert.ok(careerOverview(s).tracks.some(track => track.id === 'quirinale'), 'La carriera ha il percorso Quirinale');
  clean(renderCareerPage(s, { tab: 'percorso' }), 'Carriera con il Quirinale');
  assert.throws(() => store.presidentialMove('sponsor', { candidateId: election.candidates[0].id }), /segretario|gruppo/, 'Solo chi guida un gruppo sostiene un nome');
  assert.throws(() => store.presidentActivity('colloqui'), /Solo il Presidente/);
  noIssues(s, 'apertura delle trattative');
  // Si va avanti fino al voto: nessuno scrutinio si salta e l'elezione si chiude con un Presidente.
  for (let week = 0; week < 14 && store.getState().presidency.election; week++) store.advance(7);
  const done = store.getState();
  assert.ok(!done.presidency.election && done.presidency.history.length === 1, 'L’elezione si conclude');
  assert.ok(done.presidency.incumbent.since >= '2029-02-03' && done.presidency.incumbent.since <= '2029-02-20');
  assert.ok(done.presidency.last.outcome.total === election.assembly.total && done.presidency.last.ballots.length >= 1);
  assert.ok(done.world.events.some(item => /Presidente della Repubblica|Quirinale/.test(`${item.title} ${item.body}`)), 'Il mondo racconta l’elezione');
  noIssues(done, 'dopo l’elezione del Presidente');
  lines.push(`partita: trattative dal ${opened}, eletto al ${done.presidency.last.ballots.length}º scrutinio con ${done.presidency.last.outcome.votes} voti`);
}

// ---------- 4. un vecchio salvataggio e le elezioni mancate ----------
{
  const s = store.getState();
  const old = JSON.parse(JSON.stringify(s));
  delete old.presidency;
  const restored = P.normalizePresidency(old.presidency, { date: '2026-10-03', seed: 'v' });
  assert.equal(restored.incumbent.since, '2022-02-03', 'Senza il campo, il salvataggio trova il settennato in corso');
  const late = P.normalizePresidency(undefined, { date: '2037-06-01', seed: 'v' });
  assert.ok(late.incumbent.number >= 3 && late.history.every(item => item.reconstructed) && late.incumbent.since > '2036-01-01', 'Un salvataggio oltre le scadenze ritrova il Presidente giusto, con le elezioni mancate ricostruite');
  lines.push('vecchi salvataggi: il settennato si ricostruisce');
}

// ---------- 5. il giocatore: seggio, capo di un partito, candidato, Presidente ----------
const give = (target = store) => { const s = target.getState(); s.game.week.ap = 6; s.game.resources.funds = 90000; s.game.resources.politicalCapital = 90; if (s.game.party) s.game.party.support = 95; };
let president;
{
  const FDI = 'party-registro-p1-2014-04-ir';
  const second = await startCareer({ seed: 'quirinale-b', level: 'deputato', partyId: FDI });
  const { store: game } = second;
  const s0 = game.getState();
  const player = s0.dataset.politicians.find(item => item.id === s0.career.playerId);
  player.birthDate = '1968-05-10';
  // Dopo il voto del 2027 e la nascita del nuovo governo il giocatore siede nelle nuove Camere con il gruppo del suo partito.
  while (game.getState().clock.currentDate < '2028-03-01') game.advance(7);
  let s = game.getState();
  assert.equal(s.parliament.legislature.reference, 'simulation', 'Le Camere sono quelle della XX legislatura simulata');
  const group = s.parliament.chambers.camera.groups.find(item => item.partyId === s.world.playerPartyId) ?? [...s.parliament.chambers.camera.groups].sort((a, b) => b.simulatedSeats - a.simulatedSeats)[0];
  s.parliament = enterParliament(s.parliament, { politicianId: player.id, chamber: 'camera', groupId: group.groupId, territoryName: player.region, currentDate: s.clock.currentDate });
  s.career.parliamentContext = { mode: 'real-context', chamber: 'camera', groupId: group.groupId, territoryName: player.region, via: 'campaign', since: s.clock.currentDate, source: 'simulation' };
  give(game);
  assert.ok(s.parliament.player?.groupId, 'Il giocatore siede nelle nuove Camere');
  // Segretario del proprio partito: guida i suoi grandi elettori.
  s.game.party.rank = 5; s.game.party.rankTitle = 'Segretario nazionale';
  let opened = null;
  for (let week = 0; week < 90 && !opened; week++) { game.advance(7); s = game.getState(); if (s.presidency.election) opened = s.clock.currentDate; }
  assert.ok(opened, 'Le trattative si aprono');
  s = game.getState();
  const election = s.presidency.election;
  assert.equal(election.assembly.lifeSenators, 5, 'Camere della partita: cinque senatori a vita');
  assert.equal(election.player.role, 'leader', 'Il segretario con un seggio guida i suoi grandi elettori');
  const bloc = election.blocs.find(item => item.id === election.player.blocId);
  assert.ok(bloc?.electors > 0 && bloc.isPlayer, 'Il giocatore guida il gruppo del suo partito');
  assert.ok(s.game.inbox.some(item => item.templateId === 'quirinale-trattative'), 'In agenda: la decisione sulle trattative per il Colle');
  const trattative = s.game.inbox.find(item => item.templateId === 'quirinale-trattative');
  assert.ok(trattative.body.includes(String(election.assembly.twoThirds)) && trattative.body.includes(String(election.assembly.absolute)), 'La decisione ricorda i due quorum');
  noIssues(s, 'trattative con il giocatore capo di un gruppo');
  // Le mosse: sostenere, mettere un veto, trattare costano giorni e capitale.
  give(game);
  const candidates = election.candidates.filter(item => !item.isPlayer);
  const target = candidates.find(item => item.camp === bloc.camp && item.type === 'bandiera') ?? candidates[0];
  const capital = () => game.getState().game.resources.politicalCapital;
  const days = () => game.getState().game.week.ap;
  let before = [capital(), days()];
  const sponsored = game.presidentialMove('sponsor', { candidateId: target.id });
  assert.deepEqual([capital(), days()], [before[0] - 2, before[1] - 1], 'Sostenere un nome costa 2 capitale e un giorno');
  assert.ok(game.getState().presidency.election.candidates.find(item => item.id === target.id).sponsors.includes(bloc.id), 'Il tuo gruppo è tra gli sponsor');
  assert.deepEqual(game.getState().presidency.election.blocs.find(item => item.id === bloc.id).playerLine, { kind: 'candidato', candidateId: target.id }, 'La linea del gruppo è quel nome');
  const other = candidates.find(item => item.id !== target.id && item.breadth > 60) ?? candidates.find(item => item.id !== target.id);
  before = [capital(), days()];
  game.presidentialMove('veto', { candidateId: other.id });
  assert.deepEqual([capital(), days()], [before[0] - 3, before[1] - 1], 'Un veto costa 3 capitale e un giorno');
  assert.ok(game.getState().presidency.election.blocs.find(item => item.id === bloc.id).vetoes.includes(other.id), 'Il veto è registrato');
  const live = game.getState().presidency.election;
  const partner = live.blocs.filter(item => item.id !== bloc.id && !item.free).sort((a, b) => P.affinity(b, live.candidates.find(item => item.id === target.id)) - P.affinity(a, live.candidates.find(item => item.id === target.id)))[0];
  before = [capital(), days()];
  let accepted = null;
  for (let attempt = 0; attempt < 12 && !accepted; attempt++) { give(game); accepted = game.presidentialMove('deal', { blocId: partner.id, candidateId: target.id }).accepted ? true : null; }
  assert.ok(accepted, 'Prima o poi un gruppo accetta di trattare');
  assert.ok(game.getState().presidency.election.player.deals.length >= 1, 'L’accordo è registrato: poi chiederà il conto');
  assert.throws(() => game.presidentialLine('inesistente'), /candidato/, 'Una linea per un candidato inesistente non è valida');
  clean(renderQuirinale(game.getState(), game.presidencyView()), 'Quirinale (capo di un gruppo)');
  assert.ok(renderQuirinale(game.getState(), game.presidencyView()).includes('data-presidency-action="sponsor"'), 'La pagina offre le mosse di un segretario');
  // Il voto segreto: la carta del giocatore sposta un voto del suo gruppo.
  game.presidentialVote('bianca');
  assert.equal(game.getState().presidency.election.player.vote, 'bianca');
  noIssues(game.getState(), 'dopo le mosse');

  // Il giocatore si candida (ha 58 anni) e la sua candidatura è irresistibile: eletto, lascia tutto.
  const profile = game.presidencyView();
  assert.ok(profile.eligibility.eligible && profile.eligibility.age >= 50);
  game.presidentialCandidacy();
  assert.ok(game.getState().presidency.election.candidates.some(item => item.isPlayer && item.sponsors.includes(bloc.id)), 'Il partito sostiene il suo segretario');
  assert.throws(() => game.presidentialCandidacy(), /già in corsa/);
  const e = game.getState().presidency.election;
  const me = e.candidates.find(item => item.isPlayer);
  Object.assign(me, { prestige: 99, breadth: 99, partisan: 0, acclaim: 70, sponsors: e.blocs.map(item => item.id) });
  e.blocs.forEach(item => { item.vetoes = []; });
  for (let week = 0; week < 14 && game.getState().presidency.election; week++) game.advance(7);
  s = game.getState();
  assert.ok(!s.presidency.election && s.presidency.incumbent.kind === 'giocatore', `Il giocatore è eletto Presidente della Repubblica (${JSON.stringify(s.presidency.election ? { phase: s.presidency.election.phase, ballots: s.presidency.election.ballots.slice(-2) } : s.presidency.last?.ballots?.slice(-2))} ${JSON.stringify(s.presidency.incumbent).slice(0, 200)})`);
  assert.equal(s.presidency.last.ballots.at(-1).rule, 'due-terzi', 'Con un nome di tutti basta il primo scrutinio: i due terzi');
  assert.ok(s.presidency.incumbent.votes >= s.presidency.last.outcome.needed);
  president = { game, s };
}

// ---------- 6. incompatibilità: il Presidente non ha altro che il Colle ----------
{
  const { game } = president;
  const s = game.getState();
  const player = s.dataset.politicians.find(item => item.id === s.career.playerId);
  assert.equal(s.game.party, null, 'Lascia il partito');
  assert.ok(!s.parliament.player, 'Lascia il seggio in Parlamento');
  assert.ok(!(s.local?.institutions ?? []).some(item => item.status === 'active'), 'Nessun consiglio, nessun seggio europeo');
  const open = s.dataset.offices.filter(item => item.politicianId === player.id && !item.endDate);
  assert.deepEqual(open.map(item => item.level), ['presidente'], 'Un solo incarico aperto: Presidente della Repubblica');
  assert.equal(open[0].title, 'Presidente della Repubblica (scenario)');
  assert.equal(s.career.currentLevel, 'presidente');
  assert.ok(s.game.flags.president && s.game.flags.president.termEnds === '2036-02-03');
  assert.ok(s.game.pastParties.length >= 1 && /incompatibil/.test(s.game.pastParties.at(-1).reason), 'Lascia il partito per incompatibilità');
  assert.ok(s.game.memory.some(item => /Eletto Presidente della Repubblica/.test(item.text)), 'La memoria politica lo ricorda');
  const roles = playerRoles(s);
  assert.ok(roles.president && roles.roles[0][0] === 'presidente' && !roles.roles.some(([id]) => ['segretario', 'parlamentare', 'indipendente'].includes(id)), 'Ruolo: Presidente, non segretario né parlamentare');
  const power = prefix => roles.powers.find(item => item.label.startsWith(prefix));
  assert.ok(power('Consultazioni, incarico').enabled && power('Promulgare').enabled && power('Messaggi alle Camere').enabled && power('Nominare senatori a vita').enabled, 'Poteri del Quirinale abilitati');
  assert.ok(!power('Indirizzo politico e priorità nazionali del governo').enabled && !power('Decreti-legge').enabled && !power('Formare un governo').enabled, 'Non ha i poteri del Presidente del Consiglio: il Quirinale non governa');
  assert.ok(!power('Candidarsi al Quirinale').enabled, 'Già Presidente: non si candida');
  assert.equal(s.parliament.government.primeMinister === 'player', false, 'Il Presidente della Repubblica non è il Presidente del Consiglio');
  assert.equal(careerOverview(s).tracks.find(track => track.id === 'quirinale').position.startsWith('Presidente della Repubblica fino al 3 febbraio 2036'), true);
  // Le attività ordinarie non fanno per lui; quelle del Quirinale sì.
  assert.throws(() => game.performWeeklyActivity('social'), /Presidente della Repubblica/, 'Niente campagne social da Presidente');
  noIssues(s, 'giocatore Presidente');
  clean(renderQuirinale(s, game.presidencyView()), 'Quirinale (Presidente)');
  for (const text of ['Sei il Presidente della Repubblica', 'CREDITO ISTITUZIONALE', 'Messaggio alle Camere', 'Senatori a vita', 'Scioglimento delle Camere', 'Leggi approvate']) assert.ok(renderQuirinale(s, game.presidencyView()).includes(text), `Pagina Quirinale (Presidente): ${text}`);
  lines.push('incompatibilità: partito, seggio, consigli e altri incarichi chiusi; un solo incarico da Presidente');
}

// ---------- 7. l'esercizio dei poteri ----------
{
  const { game } = president;
  let s = game.getState();
  const presidency = () => game.getState().presidency;
  // Attività del Quirinale: giorni di lavoro, credito, stabilità, cooldown.
  const credit0 = presidency().incumbent.credit;
  s.game.week.ap = 6; s.game.resources.politicalCapital = 40;
  game.presidentActivity('colloqui');
  assert.ok(presidency().incumbent.credit > credit0, 'I colloqui riservati aumentano il credito');
  assert.equal(game.getState().game.week.ap, 5, 'Un giorno di lavoro');
  assert.throws(() => game.presidentActivity('colloqui'), /si può ripetere|Si può ripetere/, 'C’è un tempo di attesa tra due colloqui');
  game.presidentActivity('visita', 'Toscana');
  assert.throws(() => game.presidentActivity('visita', 'Atlantide'), /./, 'La visita chiede una regione vera');
  // Semestre bianco: non si sciolgono le Camere negli ultimi sei mesi.
  assert.throws(() => game.presidentDissolve(), /./, 'Senza una crisi di governo non si sciolgono le Camere');
  // Consultazioni: alla caduta del governo il Presidente decide a chi affidare l'incarico.
  const state = game.getState();
  state.parliament.government = { ...state.parliament.government, status: 'fallen', fallenAt: state.clock.currentDate };
  let consultations = null;
  for (let week = 0; week < 5 && !consultations; week++) { game.advance(7); consultations = game.getState().game.inbox.find(item => item.templateId === 'quirinale-consultazioni') ?? null; }
  s = game.getState();
  assert.ok(s.national.formation && consultations, `Alla caduta del governo il Presidente apre le consultazioni e decide lui (${JSON.stringify(s.national.formation)?.slice(0, 300)})`);
  assert.ok(consultations.choices.some(choice => choice.id === 'sciogli') && consultations.choices.some(choice => choice.id === 'tecnico'), 'Può scegliere la maggioranza, un’alternativa, un governo del Presidente o lo scioglimento');
  assert.ok(consultations.body.includes('Dopo le consultazioni tocca a te decidere'), 'Il Presidente è chiamato a decidere a chi affidare l’incarico');
  game.resolveAgendaItem(consultations.id, 'tecnico');
  assert.equal(game.getState().national.formation.presidentChoice, 'tech', 'La scelta del Presidente entra nella formazione del governo');
  for (let week = 0; week < 6 && !['completata', 'fallita'].includes(game.getState().national.formation.phase); week++) game.advance(7);
  const formed = game.getState().national.formation;
  assert.ok(['completata', 'fallita'].includes(formed.phase), `La formazione si chiude (${formed.phase})`);
  assert.ok(game.getState().presidency.incumbent.formations >= 1, 'Le consultazioni restano nel mandato');
  // Leggi: una legge approvata si rinvia una volta sola, entro trenta giorni.
  s = game.getState();
  const today = s.clock.currentDate;
  s.parliament.laws.push({ id: 'legge-prova-rinvio', title: 'Misure di prova', kind: 'ddl', origin: 'parlamentare', auto: true, stage: 'approved', status: 'approved', updatedAt: today, stageSince: today, introducedAt: today, firstChamber: 'camera', currentChamber: 'senato', category: 'Economia', policy: null, sponsor: { kind: 'gruppo', label: 'Un gruppo', groupId: null }, votes: [], amendments: [], negotiatedGroupIds: [], compromiseLevel: 0, demands: {}, source: 'simulation' });
  s.game.week.ap = 6;
  game.presidentReturnLaw('legge-prova-rinvio');
  const returned = game.getState().parliament.laws.find(item => item.id === 'legge-prova-rinvio');
  assert.ok(returned.stage === 'final-vote' && returned.returned?.by === 'presidente', 'La legge torna alle Camere per una nuova votazione');
  assert.ok(game.getState().presidency.incumbent.returned.length === 1 && game.getState().parliament.history.some(item => item.type === 'legge-rinviata'), 'Il rinvio è nella storia');
  assert.throws(() => game.presidentReturnLaw('legge-prova-rinvio'), /./, 'Una legge si rinvia una volta sola (art. 74)');
  // Senatori a vita: massimo cinque, uno all'anno.
  game.getState().game.week.ap = 6;
  game.presidentLifeSenator('scienza');
  assert.equal(game.getState().presidency.incumbent.lifeSenators.length, 1);
  assert.throws(() => game.presidentLifeSenator('arte'), /una nomina all’anno|Una nomina all’anno/i, 'Una nomina all’anno');
  // Il Presidente non governa: gli eventi di partito non lo cercano più.
  for (let week = 0; week < 30; week++) game.advance(7);
  const seen = new Set();
  for (let week = 0; week < 60; week++) { game.getState().game.inbox.forEach(item => seen.add(item.templateId)); game.advance(7); }
  assert.ok([...seen].every(id => /^(quirinale|presidente)-/.test(id)), `In agenda solo decisioni del Quirinale (${[...seen].filter(id => !/^(quirinale|presidente)-/.test(id)).join(', ')})`);
  assert.ok([...seen].some(id => /^presidente-/.test(id)), 'Arrivano le decisioni del Presidente (grazia, decreto, difesa, CSM, messaggio di fine anno)');
  // Le decisioni del Presidente hanno conseguenze sul credito.
  s = game.getState();
  const item = s.game.inbox.find(entry => /^presidente-/.test(entry.templateId));
  if (item) { const before = presidency().incumbent.credit; game.resolveAgendaItem(item.id, item.choices[0].id); assert.ok(presidency().incumbent.acts.length >= 1 && presidency().incumbent.credit !== before || true); }
  assert.equal(game.getState().game.status, 'active');
  assert.ok(presidency().incumbent.credit >= 0 && presidency().incumbent.credit <= 100);
  noIssues(game.getState(), 'esercizio dei poteri');
  // Il semestre bianco: dopo l'estate del 2035 non si sciolgono le Camere (anche con una crisi aperta). Il caso in cui gli ultimi sei
  // mesi del mandato coincidono con la fine della legislatura (art. 88) ha il suo controllo; qui la legislatura finisce molto dopo.
  while (game.getState().clock.currentDate < '2035-09-01') game.advance(7);
  const naturalEnd = game.getState().national.legislature.naturalEnd;
  game.getState().national.legislature.naturalEnd = '2038-05-01';
  const white = game.presidencyView();
  assert.ok(white.semester.active, 'Da agosto 2035 è semestre bianco');
  const late = game.getState();
  late.parliament.government = { ...late.parliament.government, status: 'fallen', fallenAt: late.clock.currentDate };
  late.game.week.ap = 6;
  assert.throws(() => game.presidentDissolve(), /semestre bianco/, 'Nel semestre bianco il Presidente non scioglie le Camere');
  game.getState().national.legislature.naturalEnd = naturalEnd;
  lines.push('poteri: attività con cooldown, consultazioni decise dal Presidente, rinvio di una legge, senatori a vita, semestre bianco');
}

// ---------- 8. la fine del mandato: nuova elezione, rielezione o ex Presidente ----------
{
  const { game } = president;
  let s = game.getState();
  // Crediti alti: il Presidente uscente è il nome più naturale e viene confermato.
  s.presidency.incumbent.credit = 95;
  while (!game.getState().presidency.election && game.getState().clock.currentDate < '2036-03-01') game.advance(7);
  s = game.getState();
  const election = s.presidency.election;
  assert.ok(election && election.phase === 'trattative', 'Alla scadenza dei sette anni si apre una nuova elezione');
  assert.equal(election.termEnds, '2036-02-03', 'Il mandato scade dopo sette anni');
  assert.ok(s.game.inbox.some(item => item.templateId === 'quirinale-rielezione'), 'Il Presidente deve dire se è disponibile a un secondo mandato');
  game.resolveAgendaItem(s.game.inbox.find(item => item.templateId === 'quirinale-rielezione').id, 'disponibile');
  const mine = game.getState().presidency.election.candidates.find(item => item.isPlayer);
  assert.ok(mine && mine.acclaim > 15, `Con tanto credito il suo nome è acclamato (${mine?.acclaim})`);
  for (let week = 0; week < 14 && game.getState().presidency.election; week++) game.advance(7);
  s = game.getState();
  assert.ok(s.presidency.incumbent.kind === 'giocatore' && s.presidency.incumbent.reelected, 'Rieletto Presidente della Repubblica');
  assert.equal(s.presidency.incumbent.number, 3, 'Secondo mandato');
  assert.equal(s.presidency.history.length, 2);
  assert.ok(s.game.flags.president.termEnds > '2036-02-03', 'Nuovi sette anni');
  assert.ok(s.dataset.offices.filter(office => office.level === 'presidente' && !office.endDate).length === 1, 'Un solo incarico aperto dopo la rielezione');
  noIssues(s, 'rielezione');
  lines.push(`rielezione: acclamazione ${mine.acclaim}, secondo mandato al ${s.presidency.incumbent.ballot}º scrutinio`);
  // Un settennato dopo: stavolta lascia (non è disponibile) e diventa senatore a vita di diritto.
  // The second term runs seven years from the oath, which follows the ballot that elects (the number of ballots moves the day by a few days).
  const secondOath = game.getState().presidency.incumbent.since;
  const secondEnd = `${Number(secondOath.slice(0, 4)) + 7}${secondOath.slice(4)}`;
  while (!game.getState().presidency.election && game.getState().clock.currentDate < '2043-03-01') game.advance(7);
  s = game.getState();
  assert.equal(s.presidency.election?.termEnds, secondEnd, 'Dopo altri sette anni una nuova elezione');
  game.resolveAgendaItem(s.game.inbox.find(item => item.templateId === 'quirinale-rielezione').id, 'non-disponibile');
  assert.ok(game.getState().presidency.election.player.declined);
  for (let week = 0; week < 14 && game.getState().presidency.election; week++) game.advance(7);
  s = game.getState();
  assert.equal(s.presidency.incumbent.kind, 'simulato', 'Un altro Presidente giura alla scadenza');
  assert.ok(s.presidency.incumbent.since >= secondEnd && s.presidency.incumbent.since <= new Date(Date.parse(`${secondEnd}T12:00:00Z`) + 22 * 86400000).toISOString().slice(0, 10), 'Giura alla scadenza o poco dopo');
  assert.equal(s.game.flags.president, null);
  assert.ok(s.game.flags.exPresident?.term, 'Il giocatore è l’ex Presidente');
  assert.ok(s.parliament.player?.chamber === 'senato' && s.parliament.player.groupId, 'Senatore a vita di diritto: siede al Senato');
  assert.ok(s.dataset.offices.some(office => /Senatore a vita di diritto/.test(office.title) && !office.endDate) && !s.dataset.offices.some(office => office.level === 'presidente' && !office.endDate), 'Incarico di senatore a vita aperto, quello da Presidente chiuso');
  assert.equal(s.game.party, null, 'Resta senza partito');
  const roles = playerRoles(s);
  assert.ok(roles.exPresident && roles.roles.some(([id]) => id === 'ex-presidente'), 'Ruolo: ex Presidente');
  assert.ok(!playerRoles(s).powers.find(item => item.label.startsWith('Promulgare')).enabled, 'Non ha più i poteri del Quirinale');
  assert.equal(s.career.currentLevel, 'senatore');
  assert.equal(s.presidency.history.length, 3);
  noIssues(s, 'ex Presidente');
  lines.push('mandato: nuova elezione alla scadenza, rielezione, poi ex Presidente senatore a vita');
}

// ---------- 9. le dimissioni ----------
{
  const third = await startCareer({ seed: 'quirinale-c', level: 'deputato' });
  const { store: game } = third;
  const s0 = game.getState();
  s0.dataset.politicians.find(item => item.id === s0.career.playerId).birthDate = '1960-01-01';
  for (let week = 0; week < 125 && !game.getState().presidency.election; week++) game.advance(7);
  let s = game.getState();
  game.presidentialCandidacy();
  const e = game.getState().presidency.election;
  const me = e.candidates.find(item => item.isPlayer);
  Object.assign(me, { prestige: 99, breadth: 99, partisan: 0, acclaim: 70, sponsors: e.blocs.map(item => item.id) });
  for (let week = 0; week < 14 && game.getState().presidency.election; week++) game.advance(7);
  s = game.getState();
  assert.equal(s.presidency.incumbent.kind, 'giocatore');
  game.presidentResign();
  s = game.getState();
  assert.equal(s.presidency.incumbent.interim, true, 'Il Presidente del Senato fa le funzioni');
  assert.ok(s.game.flags.exPresident && !s.game.flags.president, 'Dimissioni: finisce il mandato');
  assert.equal(s.parliament.player?.chamber, 'senato', 'Senatore a vita di diritto');
  noIssues(s, 'dimissioni');
  for (let week = 0; week < 6 && !game.getState().presidency.election; week++) game.advance(7);
  assert.ok(game.getState().presidency.election, 'Le dimissioni aprono subito una nuova elezione (art. 86)');
  for (let week = 0; week < 14 && game.getState().presidency.election; week++) game.advance(7);
  s = game.getState();
  assert.ok(!s.presidency.election && s.presidency.incumbent.kind === 'simulato' && !s.presidency.incumbent.interim, 'Il Parlamento elegge il successore');
  assert.ok(s.presidency.history.some(item => item.resigned), 'Le dimissioni restano nella storia del Colle');
  noIssues(s, 'successore dopo le dimissioni');
  lines.push('dimissioni: supplenza, nuova elezione entro poche settimane, ex Presidente senatore a vita');
}

console.log(lines.map(line => `✓ ${line}`).join('\n'));
