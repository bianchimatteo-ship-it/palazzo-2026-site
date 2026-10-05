// I responsabili locali del partito non sono attributi tecnici dei comitati: contano in politica. Chi guida un comitato segue
// un’area (o il giocatore), è fedele o scontento, ha preso più o meno autonomia, e il territorio risponde a lui. Il controllo del
// territorio nasce da qui e pesa sulle candidature (peso nelle liste, consenso locale), sulla mobilitazione dei volontari, sui
// delegati del congresso e sul peso dell’area, sull’organizzazione dei comitati, sui rapporti con le aree, sulla reputazione sul
// territorio e sulle promozioni; una candidatura promessa si mantiene alla compilazione delle liste o si rompe; un comitato che
// cambia mano ha un uomo nuovo; ci sono eventi sul territorio. Tutto sul motore dei comitati e della vita interna già esistente.
import assert from 'node:assert/strict';
import { advanceWeek, committeeAction, createGameState, lifeCadre, resolveInboxItem, situation } from '../src/core/career-engine.js';
import { advanceCommittees, applyCommitteeAction, committeeSupport, createCommittees, leaderStance, territorialControl } from '../src/core/committee-engine.js';
import { advanceLife, cadreDecision, honourCadrePromises, lifeDelegates, lifeOverview, respondRequest } from '../src/core/party-life-engine.js';
import { advancementOdds, progressionFactors, PROGRESSION_WEIGHTS } from '../src/core/progression-engine.js';
import { standingOf } from '../src/core/standing-engine.js';
import { objectiveAvailable, measureValue } from '../src/core/objective-engine.js';
import { CAREER_OBJECTIVES } from '../src/data/simulation/objective-rules.js';
import { DAILY_EVENTS } from '../src/data/simulation/daily-events.js';
import { LEADER_RULES } from '../src/data/simulation/committee-rules.js';
import { LIFE_SITUATIONS } from '../src/data/simulation/party-life-rules.js';
import { checkInvariants } from '../src/core/invariants.js';
import { renderPartyLife } from '../src/ui/party-life-view.js';
import { renderCommitteesPanel } from '../src/ui/committees-view.js';

const START = '2027-01-04';
const STATS = { popularity: 45, reputation: 55, notoriety: 45, influence: 45, experience: 40 };
const PLACE = { region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', province: 'Siena', provinceCode: '052', provinceType: 'Provincia' };
const UNITS = [{ code: '052', name: 'Siena', type: 'Provincia', gameRegion: 'Toscana', municipalities: 36 }, { code: '051', name: 'Arezzo', type: 'Provincia', gameRegion: 'Toscana', municipalities: 36 }, { code: '053', name: 'Grosseto', type: 'Provincia', gameRegion: 'Toscana', municipalities: 28 }];
const addDays = (date, days) => { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10); };
const rander = seed => { let a = [...seed].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 7) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const API = { date: START, remember: (g, entry) => { g.memory ??= []; g.memory.unshift({ id: `m-${g.memory.length}`, week: g.week.index, weight: 1, tone: 'neutral', source: 'simulation', ...entry }); }, memoryAbout: () => 0, changeRelation: (g, id, delta) => { const item = g.party.currents.find(entry => entry.id === id); if (item) item.value = item.relation = Math.max(0, Math.min(100, (item.value ?? 50) + delta)); }, book: (g, org, amount) => { org.treasury.balance += amount; }, createParty: () => { throw new Error('non usato'); } };
const memories = (game, kind) => (game.memory ?? []).filter(item => item.kind === kind).length;
const relationOf = (game, id) => game.party.currents.find(item => item.id === id).value;

// A member (or a founder) with the committees of the region as the store builds them: the leaders follow the areas of the party.
function makeGame(seed, { rank = 0, founder = false } = {}) {
  const game = createGameState({ seedText: seed, currentDate: START, level: 'comunale', party: { id: 'partito-prova', label: 'Partito di prova', founder }, place: PLACE, stats: STATS });
  if (!founder) { game.party.rank = rank; }
  const rand = rander(`${seed}|comitati`);
  game.party.org.committees = createCommittees(game.party.org, { region: 'Toscana', units: UNITS, home: { municipality: 'Siena', municipalityCode: '052032', provinceCode: '052' }, currents: game.party.currents, rank, founder, week: 1, rand });
  return game;
}
const localOf = game => game.party.org.committees.filter(item => item.region === 'Toscana' && item.status !== 'dissoluzione' && !item.leader.player);
// The local leaders of the party of the internal life (what advanceLife keeps), crafted for the committees that have none.
function ensureCadres(game) {
  const life = game.party.life;
  for (const committee of localOf(game)) {
    if (life.cadres.some(item => item.committeeId === committee.id)) continue;
    life.cadres.push({ id: `quadro-${committee.id}`, committeeId: committee.id, region: committee.region, level: committee.level, name: committee.name, label: committee.leader.label, currentId: committee.leader.currentId, player: false, interest: 'seggio', ambition: 70, loyalty: committee.loyalty, grievance: 20, status: 'attivo', sinceWeek: 1, lastActWeek: null, nextActWeek: 999, leaderKey: `${committee.leader.currentId ?? '-'}|${committee.leader.label}|0|${committee.leader.since ?? ''}`, source: 'simulation' });
  }
  return life.cadres;
}
// The territory held by the player's area (with), by other areas and discontent (against), or half and half.
function setLeaders(game, kind) {
  const ruling = game.party.currents[0].id, other = game.party.currents[1].id;
  game.party.alignedCurrentId = ruling;
  ensureCadres(game);
  localOf(game).forEach((committee, index) => {
    const mine = kind === 'with' || (kind === 'mixed' && index % 2 === 0);
    committee.leader = { label: 'Dirigente locale (figura simulata)', currentId: mine ? ruling : other, player: false, since: 1 };
    committee.loyalty = mine ? 88 : 28; committee.autonomy = mine ? 25 : 78; committee.status = 'consolidamento';
    const cadre = game.party.life.cadres.find(item => item.committeeId === committee.id);
    Object.assign(cadre, { currentId: committee.leader.currentId, label: committee.leader.label, loyalty: committee.loyalty, grievance: mine ? 10 : 65, status: mine ? 'attivo' : 'critico', leaderKey: `${committee.leader.currentId}|${committee.leader.label}|0|1` });
  });
  game.party.other = other;
  return game;
}

// ---------- 1. the weight of a leader, the stance and the control of a territory ----------
{
  const currents = [{ id: 'a', label: 'Area A', strength: 40, value: 50 }, { id: 'b', label: 'Area B', strength: 35, value: 50 }, { id: 'c', label: 'Area C', strength: 25, value: 20 }];
  const party = { affiliation: 'member', rank: 1, alignedCurrentId: 'a', leaderCurrentId: 'b', currents, org: { committees: [] }, life: { cadres: [] } };
  const make = (id, level, leader, extra = {}) => ({ id, level, name: id, region: 'Toscana', status: 'consolidamento', members: 100, activists: 20, organization: 70, consensus: 60, loyalty: 80, autonomy: 40, quality: 50, activity: 50, fatigue: 0, seat: 1, leader, ...extra });
  const own = make('own', 'provincia', { label: 'x', currentId: 'a', player: false });
  const stances = {
    player: leaderStance(make('p', 'comune', { label: 'Tu', currentId: null, player: true }), { party }),
    own: leaderStance(own, { party, cadre: { loyalty: 80, grievance: 10, status: 'attivo' } }),
    appointed: leaderStance(make('n', 'comune', { label: 'scelto da te', currentId: null, player: false }), { party, cadre: { loyalty: 72, grievance: 10, status: 'attivo' } }),
    other: leaderStance(make('o', 'comune', { label: 'x', currentId: 'b', player: false }, { loyalty: 55 }), { party, cadre: { loyalty: 55, grievance: 25, status: 'attivo' } }),
    hostileArea: leaderStance(make('h', 'comune', { label: 'x', currentId: 'c', player: false }, { loyalty: 35 }), { party, cadre: { loyalty: 35, grievance: 55, status: 'critico' } }),
    critical: leaderStance(own, { party, cadre: { loyalty: 40, grievance: 70, status: 'in-uscita' } }),
    autonomous: leaderStance({ ...own, autonomy: 92 }, { party, cadre: { loyalty: 80, grievance: 10, status: 'attivo' } }),
    lost: leaderStance({ ...own, status: 'perdita-controllo' }, { party, cadre: { loyalty: 80, grievance: 10, status: 'attivo' } }),
    dissolved: leaderStance({ ...own, status: 'dissoluzione' }, { party })
  };
  assert.equal(stances.player.id, 'tuo'); assert.equal(stances.player.weight, 1, 'Un comitato guidato dal giocatore risponde a lui');
  assert.equal(stances.own.id, 'con-te', 'Un responsabile fedele della tua area è con te'); assert.ok(stances.own.weight >= LEADER_RULES.stances[0].min);
  assert.equal(stances.appointed.id, 'con-te', 'Un nome scelto dal giocatore è con lui');
  assert.ok(stances.other.weight < stances.own.weight && ['da-convincere', 'distante'].includes(stances.other.id), 'Un responsabile di un’altra area va convinto');
  assert.equal(stances.hostileArea.id, 'contro', 'Un responsabile scontento di un’area ostile è contro di te');
  assert.ok(stances.critical.weight < stances.own.weight - 0.3, 'Il malcontento e la sfiducia tolgono peso a un responsabile della tua stessa area');
  assert.ok(stances.autonomous.weight < stances.own.weight - 0.2, 'Chi ha preso molta autonomia non risponde più del tutto');
  assert.ok(stances.lost.weight <= LEADER_RULES.weight.lost + 1e-9 && stances.lost.id === 'contro', 'Un comitato fuori controllo risponde a un’altra area');
  assert.equal(stances.dissolved.weight, 0);
  assert.ok(stances.hostileArea.reasons.length >= 2 && stances.other.reasons.some(text => text.includes('Area B') || text.includes('area')), 'Ogni peso ha le sue ragioni leggibili');
  // The leader of the party counts the ruling area as his own.
  const asLeader = leaderStance(make('l', 'comune', { label: 'x', currentId: 'b', player: false }, { loyalty: 55 }), { party: { ...party, rank: 5 }, cadre: { loyalty: 55, grievance: 25, status: 'attivo' } });
  assert.ok(asLeader.weight > stances.other.weight + 0.1, 'Il segretario conta come proprio l’area che guida il partito');

  // The control of a territory: the leaders counted by level and strength.
  const loyaltyOf = leader => ({ loyalty: leader.currentId === 'a' ? 80 : 35 });
  const network = leaders => ({ ...party, org: { committees: [make('r', 'regione', leaders[0], loyaltyOf(leaders[0])), make('p1', 'provincia', leaders[1], loyaltyOf(leaders[1])), make('p2', 'provincia', leaders[2], loyaltyOf(leaders[2])), make('c', 'comune', leaders[3], loyaltyOf(leaders[3]))] }, life: { cadres: [] } });
  const mine = { label: 'x', currentId: 'a', player: false }, theirs = { label: 'x', currentId: 'c', player: false };
  const withYou = territorialControl(network([mine, mine, mine, mine]), { region: 'Toscana' });
  const mixed = territorialControl(network([mine, theirs, mine, theirs]), { region: 'Toscana' });
  const against = territorialControl(network([theirs, theirs, theirs, theirs]), { region: 'Toscana' });
  assert.ok(withYou.index > mixed.index && mixed.index > against.index, `Più responsabili con te, più controllo (${withYou.index} > ${mixed.index} > ${against.index})`);
  assert.ok(withYou.index >= 70 && against.index <= 40, 'Il controllo ha una scala leggibile');
  assert.ok(Math.abs(Object.values(withYou.byCurrent).reduce((a, b) => a + b, 0) - 1) < 0.03 && withYou.byCurrent.a >= 0.99, 'Chi guida i comitati: la quota delle aree somma a uno');
  assert.equal(withYou.byStance['con-te'], 4);
  assert.equal(territorialControl(network([mine, mine, mine, mine]), { region: 'Lombardia' }), null, 'Nessun comitato nel territorio: nessun controllo');
  assert.equal(territorialControl({ ...party, org: { committees: [] } }), null);
  // A single committee is too little to say how far a territory is held: the figure stays near the neutral one.
  const alone = territorialControl({ ...party, org: { committees: [make('c', 'comune', { label: 'Tu', currentId: null, player: true })] }, life: { cadres: [] } }, { region: 'Toscana' });
  assert.ok(alone.index > 50 && alone.index < 75, `Pochi comitati: il controllo resta vicino al neutro (${alone.index})`);
  const dissolved = territorialControl({ ...party, org: { committees: [make('r', 'regione', mine), make('d', 'provincia', mine, { status: 'dissoluzione' })] } }, { region: 'Toscana' });
  assert.equal(dissolved.count, 1, 'I comitati sciolti non contano');
}

// ---------- 2. candidacies: weight in the lists, local consent, the volunteers that move ----------
{
  const support = kind => {
    const game = setLeaders(makeGame('liste'), kind);
    for (const committee of game.party.org.committees) { committee.mobilizedUntil = 20; }
    return committeeSupport(game.party.org, { electionType: 'comunale', region: 'Toscana', provinceCode: '052', municipality: 'Siena', week: 10, party: game.party });
  };
  const withYou = support('with'), against = support('against'), mixed = support('mixed');
  assert.ok(withYou.control && against.control && withYou.control.index > mixed.control.index && mixed.control.index > against.control.index, 'La candidatura legge il controllo del territorio del voto');
  assert.ok(withYou.nomination > against.nomination + 0.5, `Il peso nelle liste segue i responsabili (${withYou.nomination} contro ${against.nomination})`);
  assert.ok(withYou.localSupport > against.localSupport, `Il consenso locale segue i responsabili (${withYou.localSupport} contro ${against.localSupport})`);
  assert.ok(withYou.gotv > against.gotv * 1.15 && withYou.volunteers >= against.volunteers, `I volontari si muovono quanto li spingono i responsabili (${withYou.gotv} contro ${against.gotv})`);
  // Without the party (an old call) the figures are those the committees had before: nothing changes.
  const game = setLeaders(makeGame('liste'), 'with');
  const plain = committeeSupport(game.party.org, { electionType: 'comunale', region: 'Toscana', provinceCode: '052', municipality: 'Siena', week: 10 });
  assert.equal(plain.control, null);
  assert.ok(plain.gotv >= against.gotv, 'Senza il partito resta la mobilitazione di prima');
  // A committee that has gone to another area works against the candidate.
  const lost = setLeaders(makeGame('liste'), 'with');
  for (const committee of lost.party.org.committees) if (committee.region === 'Toscana') committee.status = 'perdita-controllo';
  const lostSupport = committeeSupport(lost.party.org, { electionType: 'comunale', region: 'Toscana', provinceCode: '052', municipality: 'Siena', week: 10, party: lost.party });
  assert.ok(lostSupport.nomination < against.nomination + 0.3 && lostSupport.nomination < withYou.nomination - 1, 'Un comitato fuori controllo pesa sulla candidatura');
  assert.ok(new Set([withYou.nomination, mixed.nomination, against.nomination]).size === 3, 'Ogni livello di controllo dà un peso diverso');
}

// ---------- 3. mobilisation: the volunteers move as far as their leader pushes ----------
{
  const run = stance => {
    const game = setLeaders(makeGame('mobilita'), 'mixed');
    const committee = localOf(game).find(item => item.level === 'comune') ?? localOf(game)[0];
    committee.activists = 40;
    const lines = applyCommitteeAction(game.party.org, committee, 'mobilita', { week: 10, currents: game.party.currents, leader: false, scale: 'regionale', ...(stance ? { stance } : {}) });
    return { activists: committee.activists, weeks: committee.mobilizedUntil - 10, lines };
  };
  const push = run({ weight: 0.9 }), plain = run(null), reluctant = run({ weight: 0.15 });
  assert.ok(push.activists > plain.activists && plain.activists > reluctant.activists, `Più il responsabile spinge, più volontari si mobilitano (${push.activists} > ${plain.activists} > ${reluctant.activists})`);
  assert.equal(plain.activists, Math.round(40 * 1.35 + 3), 'Senza un responsabile noto la mobilitazione è quella di sempre');
  assert.ok(push.weeks === 4 && reluctant.weeks === 3, 'Un responsabile che non spinge dura meno');
  assert.ok(push.lines[0].includes('spinge') && reluctant.lines[0].includes('non spinge'));
  // The career pipeline passes the stance of the leader of the committee it acts on: the same action, a leader with the player and one against.
  const through = kind => {
    const game = setLeaders(makeGame('mobilita2'), kind);
    const committee = localOf(game).find(item => item.level === 'comune') ?? localOf(game)[0];
    committee.activists = 40;
    game.resources.funds = 5000; game.resources.politicalCapital = 30; game.week.ap = 5;
    const out = committeeAction({ game, stats: { ...STATS }, parliament: null }, { currentDate: START }, 'mobilita', { committeeId: committee.id });
    return out.ctx.game.party.org.committees.find(item => item.id === committee.id).activists;
  };
  assert.ok(through('with') > through('against'), 'Nella partita vera la mobilitazione segue il responsabile del comitato');
}

// ---------- 4. organisation: the mood of the leader works on the committee ----------
{
  const organizationAfter = status => {
    const game = setLeaders(makeGame('organizzazione'), 'with');
    for (const cadre of game.party.life.cadres) Object.assign(cadre, status === 'in-uscita' ? { status: 'in-uscita', loyalty: 20, grievance: 80 } : status === 'critico' ? { status: 'critico', loyalty: 40, grievance: 60 } : { status: 'attivo', loyalty: 85, grievance: 10 });
    const rand = rander('organizzazione');
    for (let week = 1; week <= 60; week++) advanceCommittees(game.party.org, { rand, week, currents: game.party.currents, cadres: game.party.life.cadres, homeRegion: null });
    const list = localOf(game).filter(item => item.level !== 'regione');
    return list.reduce((sum, item) => sum + item.organization, 0) / list.length;
  };
  const loyal = organizationAfter('attivo'), critical = organizationAfter('critico'), leaving = organizationAfter('in-uscita');
  assert.ok(loyal > critical + 3 && critical > leaving + 2, `L’umore del responsabile muove l’organizzazione del comitato (${loyal.toFixed(1)} > ${critical.toFixed(1)} > ${leaving.toFixed(1)})`);
  // Without the cadres (an old save) the committees go on as before.
  const game = setLeaders(makeGame('organizzazione'), 'with');
  assert.doesNotThrow(() => advanceCommittees(game.party.org, { rand: rander('x'), week: 1, currents: game.party.currents }));
}

// ---------- 5. the areas: delegates of the congress, the weight of the area, the discontent that goes up, the relations ----------
{
  const currents = [{ id: 'a', label: 'Area A', strength: 40, value: 50 }, { id: 'b', label: 'Area B', strength: 35, value: 50 }, { id: 'c', label: 'Area C', strength: 25, value: 50 }];
  const make = (id, level, region, currentId, extra = {}) => ({ id, level, name: id, region, status: 'consolidamento', members: 100, activists: 20, organization: 60, consensus: 60, loyalty: 60, autonomy: 40, quality: 50, activity: 50, leader: { label: 'x', currentId, player: false }, ...extra });
  const delegates = led => {
    const party = { affiliation: 'member', rank: 1, currents, org: { sections: [{ region: 'Toscana', members: 4000, vitality: 60 }, { region: 'Lombardia', members: 4000, vitality: 60 }], committees: [make('rt', 'regione', 'Toscana', 'b'), make('rl', 'regione', 'Lombardia', 'b'), ...led.map((id, index) => make(`l${index}`, index % 2 ? 'comune' : 'provincia', 'Toscana', id))] }, affiliationShare: 0 };
    const life = { actors: Object.fromEntries(currents.map(item => [item.id, { momentum: 0, ambition: 50, loyalty: 50, grievance: 20 }])), pacts: [], cadres: [] };
    return lifeDelegates(party, life, { id: 'congresso-50', voteWeek: 50, mobilization: {} });
  };
  const none = delegates(['b', 'b', 'b', 'b']), followA = delegates(['a', 'a', 'a', 'a']);
  const row = result => result.byRegion.find(item => item.region === 'Toscana').byCurrent;
  assert.ok(row(followA).a > row(none).a, `I responsabili locali di un’area portano i suoi delegati (${row(followA).a} contro ${row(none).a})`);
  assert.ok(row(followA).b < row(none).b, 'E li tolgono agli altri');
  assert.deepEqual(followA.byRegion.find(item => item.region === 'Lombardia').byCurrent, none.byRegion.find(item => item.region === 'Lombardia').byCurrent, 'Le altre regioni non cambiano');

  // The weight of the area in the promotions counts how many local leaders follow it.
  const factors = kind => progressionFactors({ game: setLeaders(makeGame('aree', { rank: 1 }), kind), stats: STATS });
  const f = { with: factors('with'), mixed: factors('mixed'), against: factors('against') };
  assert.ok(f.with.current > f.mixed.current && f.mixed.current > f.against.current, `Il peso della tua area conta i responsabili locali che la seguono (${f.with.current.toFixed(1)} > ${f.mixed.current.toFixed(1)} > ${f.against.current.toFixed(1)})`);

  // The discontent of the leaders reaches their area every week, and the relations answer to what the player does with them.
  const heard = critical => {
    const game = setLeaders(makeGame('aree-malcontento'), critical ? 'against' : 'with');
    const area = game.party.other;
    const actor = () => game.party.life.actors[area];
    const before = actor().grievance;
    for (let week = 2; week <= 12; week++) { game.week.index = week; advanceLife(game, API, { week, date: addDays(START, week * 7), rand: rander(`m${week}`), env: {} }); for (const cadre of game.party.life.cadres) cadre.nextActWeek = 999; }
    return actor().grievance - before;
  };
  assert.ok(heard(true) > heard(false) + 2, 'I responsabili scontenti fanno salire il malcontento della loro area');
  const game = setLeaders(makeGame('aree-rapporti', { rank: 1 }), 'mixed');
  game.resources.politicalCapital = 40; game.week.ap = 6;
  const cadre = game.party.life.cadres.find(item => item.currentId === game.party.other);
  const area = game.party.other;
  const call = action => lifeCadre({ game, stats: { ...STATS }, parliament: null }, { currentDate: START }, { action, cadreId: cadre.id }).ctx.game;
  const r0 = relationOf(game, area);
  assert.ok(relationOf(call('incontra'), area) > r0, 'Incontrare un responsabile migliora i rapporti con la sua area');
  const r1 = relationOf(call('promuovi'), area);
  assert.ok(r1 >= r0 + 2, 'Promuoverlo li migliora ancora');
  const r2 = relationOf(call('sostituisci'), area);
  assert.ok(r2 < r1 - 1, 'Sostituirlo li peggiora: l’area perde un suo uomo');
  // One who leaves takes the committee to another area: his area loses ground, the other gains.
  const g3 = setLeaders(makeGame('aree-fuga'), 'mixed');
  const leaver = g3.party.life.cadres.find(item => item.currentId === g3.party.other);
  const r3 = relationOf(g3, g3.party.other);
  const mom = g3.party.life.actors[g3.party.other].momentum;
  cadreDecision(g3, API, { cadreId: leaver.id, choice: 'leave', week: 2, date: START, rand: rander('f') });
  assert.ok(relationOf(g3, g3.party.other) < r3 && g3.party.life.actors[g3.party.other].momentum < mom, 'Se un responsabile se ne va la sua area ne risente');
}

// ---------- 6. progression and reputation: who follows the player weighs in the promotions ----------
{
  const view = kind => {
    const game = setLeaders(makeGame('promozioni', { rank: 1 }), kind);
    const factors = progressionFactors({ game, stats: STATS });
    return { factors, locale: advancementOdds('locale', { factors, threshold: 52, game, capital: 20 }), partito: advancementOdds('partito', { factors, threshold: 55, game, capital: 20 }), territorial: standingOf({ game, stats: STATS }).reputation.territorial };
  };
  const withYou = view('with'), against = view('against');
  assert.ok(withYou.factors.leaders > 70 && against.factors.leaders < 40, `Il fattore dei dirigenti locali (${withYou.factors.leaders} contro ${against.factors.leaders})`);
  assert.ok(withYou.locale.score > against.locale.score + 2 && withYou.locale.chance > against.locale.chance + 0.05, `Una candidatura locale è più probabile con il territorio (${withYou.locale.chance} contro ${against.locale.chance})`);
  assert.ok(withYou.partito.score > against.partito.score + 2, 'E una promozione nel partito pure');
  assert.ok(withYou.locale.factors.some(row => row.id === 'leaders' && row.label.includes('Dirigenti locali')) && withYou.partito.factors.some(row => row.id === 'leaders'), 'Il fattore è nella spiegazione delle probabilità');
  assert.ok(!PROGRESSION_WEIGHTS.parlamento.some(([id]) => id === 'leaders') && !PROGRESSION_WEIGHTS.governo.some(([id]) => id === 'leaders'), 'In Parlamento e al Governo i responsabili locali non contano');
  for (const [kind, weights] of Object.entries(PROGRESSION_WEIGHTS)) assert.ok(Math.abs(weights.reduce((sum, [, , weight]) => sum + weight, 0) - 1) < 1e-9, `${kind}: i pesi sommano a uno`);
  const part = view_ => view_.territorial.parts.find(item => item.label === 'Dirigenti locali con te');
  assert.ok(part(withYou)?.value > 0 && part(against)?.value < 0 && withYou.territorial.value > against.territorial.value, 'La reputazione sul territorio conta i responsabili che ti seguono');
  // No network, no leaders: the factor is neutral (an independent is not touched).
  const independent = createGameState({ seedText: 'indipendente', currentDate: START, level: 'comunale', party: null, place: PLACE, stats: STATS });
  assert.equal(progressionFactors({ game: independent, stats: STATS }).leaders, 50);
}

// ---------- 7. the promise of a candidacy: kept when the lists are drawn up, or broken ----------
{
  const secretary = () => {
    const game = setLeaders(makeGame('promesse', { rank: 5 }), 'mixed');
    game.party.rank = 5; game.party.rankTitle = 'Segretario nazionale';
    const election = game.elections.find(item => item.status === 'upcoming');
    const cadre = game.party.life.cadres.find(item => item.currentId === game.party.other) ?? game.party.life.cadres[0];
    return { game, election, cadre };
  };
  // The request of a local leader who wants to be a candidate ends in a promise that he remembers.
  {
    const { game, election, cadre } = secretary();
    game.week.index = 10;
    game.party.life.requests.push({ id: 'richiesta-10-1', kind: 'candidatura-locale', from: 'cadre', refId: cadre.id, title: 'Una candidatura', body: 'x', acceptLabel: 'promettigli una candidatura', ask: { electionId: election.id }, counter: null, stage: 'aperta', week: 10, dueWeek: 16, delays: 0, source: 'simulation' });
    const grievance = cadre.grievance;
    respondRequest(game, API, { requestId: 'richiesta-10-1', choice: 'accetta', week: 10, date: START, rand: rander('p') });
    assert.ok(cadre.promise && cadre.promise.electionId === election.id && cadre.promise.until === 62 && cadre.grievance < grievance, 'La candidatura promessa resta segnata sul responsabile');
    const loyalty = cadre.loyalty, area = relationOf(game, cadre.currentId);
    // A different election: the promise is not kept yet.
    assert.deepEqual(honourCadrePromises(game, API, { week: 11, date: START, electionId: 'elezione-altra' }), []);
    assert.ok(cadre.promise, 'La promessa vale per la sua elezione');
    const lines = honourCadrePromises(game, API, { week: 12, date: START, electionId: election.id });
    assert.ok(lines.length === 1 && lines[0].includes('come promesso') && !cadre.promise && cadre.kept === 1, 'Compilando le liste la promessa è mantenuta');
    assert.ok(cadre.loyalty >= loyalty + LEADER_RULES.promise.keptLoyalty - 1 && relationOf(game, cadre.currentId) > area && memories(game, 'promessa-mantenuta') === 1, 'Il responsabile e la sua area lo ricordano');
    assert.deepEqual(honourCadrePromises(game, API, { week: 13, date: START, electionId: election.id }), [], 'Una promessa mantenuta non si paga due volte');
  }
  // A member who does not draw up the lists gives his support, which is not a promise: nothing to keep and nothing to break.
  {
    const game = setLeaders(makeGame('promesse-iscritto', { rank: 1 }), 'mixed');
    const election = game.elections.find(item => item.status === 'upcoming');
    const cadre = game.party.life.cadres.find(item => item.currentId === game.party.other);
    game.week.index = 10;
    game.party.life.requests.push({ id: 'richiesta-10-3', kind: 'candidatura-locale', from: 'cadre', refId: cadre.id, title: 'Una candidatura', body: 'x', acceptLabel: 'promettigli il tuo sostegno', ask: { electionId: election.id }, counter: null, stage: 'aperta', week: 10, dueWeek: 16, delays: 0, source: 'simulation' });
    const loyalty = cadre.loyalty;
    respondRequest(game, API, { requestId: 'richiesta-10-3', choice: 'accetta', week: 10, date: START, rand: rander('p3') });
    assert.ok(!cadre.promise && cadre.loyalty > loyalty, 'Chi non compila le liste dà il suo sostegno, non una promessa');
    election.status = 'held'; cadre.nextActWeek = 999;
    advanceLife(game, API, { week: 30, date: addDays(START, 200), rand: rander('p3b'), env: {} });
    assert.ok(!cadre.broken && memories(game, 'promessa-tradita') === 0, 'E non c’è nulla da rompere');
    // A promise left over from an older save, from a player who does not draw up the lists, lapses without blame.
    cadre.promise = { week: 1, electionId: election.id, until: 20 };
    advanceLife(game, API, { week: 31, date: addDays(START, 207), rand: rander('p3c'), env: {} });
    assert.ok(!cadre.promise && !cadre.broken && memories(game, 'promessa-tradita') === 0, 'Una promessa di un vecchio salvataggio decade senza colpa');
  }
  // The lists of that vote are already drawn up: there is still time to add a name, so the promise is kept at once.
  {
    const { game, election, cadre } = secretary();
    game.week.index = 10;
    game.party.org.selections = { [election.id]: { method: 'segreteria', bonus: 6, week: 9, election: election.label, source: 'simulation' } };
    game.party.life.requests.push({ id: 'richiesta-10-2', kind: 'candidatura-locale', from: 'cadre', refId: cadre.id, title: 'Una candidatura', body: 'x', acceptLabel: 'promettigli una candidatura', ask: { electionId: election.id }, counter: null, stage: 'aperta', week: 10, dueWeek: 16, delays: 0, source: 'simulation' });
    respondRequest(game, API, { requestId: 'richiesta-10-2', choice: 'accetta', week: 10, date: START, rand: rander('p2') });
    assert.ok(!cadre.promise && cadre.kept === 1 && memories(game, 'promessa-mantenuta') === 1, 'Se le liste sono già compilate la candidatura è inserita subito');
  }
  // Broken: time runs out, or the vote goes by without the lists.
  for (const how of ['scaduta', 'voto-passato']) {
    const { game, election, cadre } = secretary();
    game.week.index = 20;
    cadre.promise = { week: 5, electionId: election.id, until: how === 'scaduta' ? 19 : 80 };
    if (how === 'voto-passato') election.status = 'held';
    const loyalty = cadre.loyalty, area = relationOf(game, cadre.currentId), grievance = cadre.grievance;
    cadre.nextActWeek = 999;
    advanceLife(game, API, { week: 20, date: addDays(START, 140), rand: rander(`b-${how}`), env: {} });
    assert.ok(!cadre.promise && cadre.broken === 1, `${how}: la promessa non mantenuta si rompe`);
    assert.ok(cadre.loyalty < loyalty - 10 && cadre.grievance > grievance + 10 && relationOf(game, cadre.currentId) < area && memories(game, 'promessa-tradita') === 1, `${how}: il responsabile se la lega al dito, e la sua area`);
  }
  // In the weekly pipeline: the secretary draws up the lists of the election that is coming and keeps the promise.
  {
    const { game, election, cadre } = secretary();
    cadre.promise = { week: 1, electionId: election.id, until: 60 }; cadre.nextActWeek = 999;
    election.windowOpensAt = addDays(START, 14); election.windowClosesAt = addDays(START, 60); election.electionDate = addDays(START, 80);
    game.party.org.selections = {};
    const out = advanceWeek({ game, stats: { ...STATS }, parliament: null }, { currentDate: addDays(START, 7), pollDelta: 0 });
    const next = out.ctx.game;
    const kept = next.party.life.cadres.find(item => item.id === cadre.id);
    assert.ok(next.party.org.selections?.[election.id]?.method === 'segreteria', 'Il segretario compila le liste');
    assert.ok(!kept.promise && kept.kept === 1, 'Nello stesso momento la promessa ai responsabili è mantenuta');
  }
  // The decision of the desk: a promise made to the most ambitious one (only for who draws up the lists).
  {
    const { game, election } = secretary();
    for (const [index, cadre] of game.party.life.cadres.entries()) cadre.ambition = 60 + index;
    const top = [...game.party.life.cadres].sort((a, b) => b.ambition - a.ambition)[0];
    const template = DAILY_EVENTS.find(item => item.id === 'responsabili-liste');
    const sit = situation({ game, stats: { ...STATS }, parliament: null }, { currentDate: START, signals: {} });
    assert.ok(template.when(sit), 'Il segretario con responsabili ambiziosi e liste da compilare vive l’evento');
    game.inbox.push({ id: 'agenda-1-responsabili-liste', kind: 'evento', templateId: template.id, title: template.title, body: template.body, params: {}, choices: template.choices.map(item => ({ id: item.id, label: item.label, cost: item.cost ?? null, requires: null })), defaultChoice: template.defaultChoice, week: game.week.index, source: 'simulation' });
    game.resources.politicalCapital = 20;
    const out = resolveInboxItem({ game, stats: { ...STATS }, parliament: null }, { currentDate: START }, 'agenda-1-responsabili-liste', 'promessa');
    const picked = out.ctx.game.party.life.cadres.find(item => item.id === top.id);
    assert.ok(picked.promise && picked.promise.electionId === game.elections.filter(item => ['upcoming', 'open'].includes(item.status) && !game.party.org.selections?.[item.id]).sort((a, b) => a.electionDate.localeCompare(b.electionDate))[0].id, 'La promessa va al più ambizioso, per la prossima elezione con liste da compilare');
    void election;
    const member = situation({ game: setLeaders(makeGame('promesse-iscritto', { rank: 1 }), 'with'), stats: { ...STATS }, parliament: null }, { currentDate: START, signals: {} });
    assert.ok(!template.when(member), 'Chi non compila le liste non può promettere posti');
  }
}

// ---------- 8. a committee that changes hands has a new man; an old save keeps the one it has ----------
{
  const game = setLeaders(makeGame('rinnovo', { rank: 5 }), 'mixed');
  game.resources.politicalCapital = 40;
  const cadre = game.party.life.cadres.find(item => item.currentId === game.party.other);
  const committee = game.party.org.committees.find(item => item.id === cadre.committeeId);
  cadre.promise = { week: 1, electionId: 'x', until: 90 }; cadre.grievance = 55; cadre.ambition = 99; cadre.nextActWeek = 999;
  applyCommitteeAction(game.party.org, committee, 'responsabile', { week: 5, currents: game.party.currents, rand: rander('r') });
  const key = cadre.leaderKey;
  advanceLife(game, API, { week: 6, date: START, rand: rander('r2'), env: {} });
  assert.ok(cadre.leaderKey !== key && !cadre.promise && cadre.grievance < 30 && cadre.ambition < 99, 'Cambiato il responsabile, il dirigente è un altro: umore, ambizione e promesse non si trascinano');
  assert.ok(cadre.currentId === null && cadre.label.includes('vicina a te'), 'E ha il nome che gli ha dato il giocatore');
  // The same man stays the same: a week with no change touches nothing.
  const kept = { promise: { week: 1, electionId: 'y', until: 90 } };
  cadre.promise = kept.promise; cadre.nextActWeek = 999;
  advanceLife(game, API, { week: 7, date: START, rand: rander('r3'), env: {} });
  assert.deepEqual(cadre.promise, kept.promise);
  // A save from before the person was tracked: the leader on record is kept.
  const old = setLeaders(makeGame('vecchio', { rank: 5 }), 'mixed');
  const oldCadre = old.party.life.cadres[0];
  oldCadre.promise = { week: 1, electionId: 'z', until: 90 }; oldCadre.nextActWeek = 999; delete oldCadre.leaderKey;
  for (const item of old.party.org.committees) if (item.leader) delete item.leader.since;
  advanceLife(old, API, { week: 3, date: START, rand: rander('v'), env: {} });
  assert.ok(oldCadre.promise && oldCadre.leaderKey, 'Un vecchio salvataggio non rinnova nessuno');
  // Recruited and replaced by the player: a new man too, with no promise.
  old.resources.politicalCapital = 40; old.week.ap = 5;
  const replaced = lifeCadre({ game: old, stats: { ...STATS }, parliament: null }, { currentDate: START }, { action: 'sostituisci', cadreId: oldCadre.id }).ctx.game;
  const fresh = replaced.party.life.cadres.find(item => item.id === oldCadre.id);
  assert.ok(!fresh.promise && fresh.recruitedBy === 'player' && fresh.currentId === null, 'Il dirigente sostituito dal giocatore non porta con sé le promesse');
}

// ---------- 9. the local leader with a following: a package of memberships ----------
{
  const game = setLeaders(makeGame('tessere', { rank: 1 }), 'with');
  const cadre = game.party.life.cadres.find(item => localOf(game).find(entry => entry.id === item.committeeId)?.level !== 'regione');
  Object.assign(cadre, { ambition: 85, loyalty: 80, grievance: 10, status: 'attivo', nextActWeek: 0, lastTesseraWeek: undefined });
  const committee = game.party.org.committees.find(item => item.id === cadre.committeeId);
  committee.organization = 70;
  let raised = null;
  const rand = rander('tessere');
  for (let week = 2; week <= 80 && !raised; week++) {
    game.week.index = week; cadre.nextActWeek = 0;
    const out = advanceLife(game, API, { week, date: addDays(START, week * 7), rand, env: {} });
    raised = out.raises.find(item => item.id === 'capobastone-tessere' && item.params.cadreId === cadre.id) ?? null;
    for (const other of game.party.life.cadres) if (other.id !== cadre.id) other.nextActWeek = 999;
  }
  assert.ok(raised && raised.params.body.includes('iscrizioni in blocco') && LIFE_SITUATIONS['capobastone-tessere'].choices.map(item => item.special).join().includes('life-cadre-tessere'), 'Un responsabile con un seguito porta un pacchetto di tessere');
  const fresh = side => { const g = setLeaders(makeGame('tessere2', { rank: 1 }), 'with'); const c = g.party.life.cadres.find(item => item.id === cadre.id); return { g, c, committee: g.party.org.committees.find(item => item.id === c.committeeId) }; };
  // Accepted without checking (a scandal when the dice say so), checked (fewer, safe), refused (the leader resents it).
  const blind = fresh(), noScandal = fresh(), checked = fresh(), refused = fresh();
  const base = blind.committee.members, cohesion = blind.g.party.org.cohesion;
  cadreDecision(blind.g, API, { cadreId: cadre.id, choice: 'tessere', week: 5, date: START, rand: () => 0.1 });
  cadreDecision(noScandal.g, API, { cadreId: cadre.id, choice: 'tessere', week: 5, date: START, rand: () => 0.9 });
  cadreDecision(checked.g, API, { cadreId: cadre.id, choice: 'verifica', week: 5, date: START, rand: () => 0.1 });
  const grievance = refused.c.grievance, loyalty = refused.c.loyalty;
  cadreDecision(refused.g, API, { cadreId: cadre.id, choice: 'rifiuta', week: 5, date: START, rand: () => 0.1 });
  assert.ok(noScandal.committee.members > checked.committee.members && checked.committee.members > base, 'Le tessere portano iscritti, quelle verificate meno');
  assert.ok(blind.g.party.org.cohesion === cohesion - 2 && memories(blind.g, 'scandalo') === 1 && memories(noScandal.g, 'scandalo') === 0 && memories(checked.g, 'scandalo') === 0, 'Le tessere in blocco senza verifica possono finire sui giornali');
  assert.ok(refused.c.grievance === grievance + 10 && refused.c.loyalty === loyalty - 6 && refused.committee.members === base, 'Rifiutare scontenta il responsabile');
  assert.ok(checked.c.loyalty > refused.c.loyalty && noScandal.c.loyalty > checked.c.loyalty, 'E accettare lo lega a te');
}

// ---------- 10. the events of the territory ----------
{
  const sfugge = DAILY_EVENTS.find(item => item.id === 'territorio-sfugge'), compatto = DAILY_EVENTS.find(item => item.id === 'territorio-compatto');
  const sitOf = game => situation({ game, stats: { ...STATS }, parliament: null }, { currentDate: START, signals: {} });
  const against = setLeaders(makeGame('eventi', { rank: 1 }), 'against'), withYou = setLeaders(makeGame('eventi', { rank: 1 }), 'with');
  assert.ok(sfugge.when(sitOf(against)) && !compatto.when(sitOf(against)), 'Il territorio che sfugge');
  assert.ok(!sfugge.when(sitOf(withYou)) && compatto.when(sitOf(withYou)), 'Il territorio compatto');
  assert.equal(sitOf(createGameState({ seedText: 'x', currentDate: START, level: 'comunale', party: null, place: PLACE, stats: STATS })).territory, null, 'Senza partito nessun evento sui responsabili');
  const respond = (game, templateId, choiceId) => {
    const template = DAILY_EVENTS.find(item => item.id === templateId);
    game.inbox.push({ id: `agenda-1-${templateId}`, kind: 'evento', templateId, title: template.title, body: template.body, params: {}, choices: template.choices.map(item => ({ id: item.id, label: item.label, cost: item.cost ?? null, requires: null })), defaultChoice: template.defaultChoice, week: game.week.index, source: 'simulation' });
    game.resources.politicalCapital = 20; game.week.ap = 6;
    return resolveInboxItem({ game, stats: { ...STATS }, parliament: null }, { currentDate: START }, `agenda-1-${templateId}`, choiceId).ctx.game;
  };
  // A round of the committees: they are heard, loyalty rises, the control with it.
  const before = territorialControl(against.party, { region: 'Toscana' }).index;
  const toured = respond(against, 'territorio-sfugge', 'giro');
  assert.ok(territorialControl(toured.party, { region: 'Toscana' }).index > before, 'Il giro dei comitati recupera controllo');
  assert.ok(toured.party.life.cadres.every(item => item.grievance < 65), 'I responsabili ascoltati sono meno scontenti');
  // A man of trust where the territory slips most.
  const worst = [...localOf(against)].sort((a, b) => leaderStance(a, { party: against.party, cadre: against.party.life.cadres.find(item => item.committeeId === a.id) }).weight - leaderStance(b, { party: against.party, cadre: against.party.life.cadres.find(item => item.committeeId === b.id) }).weight)[0];
  const coordinated = respond(against, 'territorio-sfugge', 'coordinatore');
  const changed = coordinated.party.org.committees.find(item => item.id === worst.id);
  assert.ok(changed.leader.label.includes('vicina a te') && changed.leader.since !== undefined, 'Un coordinatore di fiducia dove si perde più terreno');
}

// ---------- 11. the goal of the territory ----------
{
  const spec = CAREER_OBJECTIVES.find(item => item.id === 'territorio-con-te');
  assert.ok(spec && spec.line === 'territorio' && spec.reward.standing?.territorial, 'L’obiettivo del territorio ha il suo premio sulla reputazione');
  const game = setLeaders(makeGame('obiettivo', { rank: 1 }), 'with');
  const independent = createGameState({ seedText: 'o', currentDate: START, level: 'comunale', party: null, place: PLACE, stats: STATS });
  assert.ok(objectiveAvailable(spec, { game }, {}) && !objectiveAvailable(spec, { game: independent }, {}), 'Esiste solo per chi ha il suo partito sul territorio');
  const control = measureValue(spec.measures[0], { game, stats: STATS }), withYou = measureValue(spec.measures[1], { game, stats: STATS });
  assert.ok(control >= spec.measures[0].target && withYou >= spec.measures[1].target, `Misurato sui responsabili (${control}, ${withYou})`);
  const against = setLeaders(makeGame('obiettivo', { rank: 1 }), 'against');
  assert.ok(measureValue(spec.measures[0], { game: against, stats: STATS }) < spec.measures[0].target && measureValue(spec.measures[1], { game: against, stats: STATS }) === 0, 'Non si raggiunge con il territorio contro');
}

// ---------- 12. what the player sees ----------
{
  const game = setLeaders(makeGame('vista', { rank: 1 }), 'mixed');
  game.party.life.cadres[0].promise = { week: 1, electionId: 'x', until: 30 };
  const view = lifeOverview(game);
  assert.ok(view.control && view.control.index > 0 && view.cadres.every(item => item.player || (item.stance && Number.isFinite(item.autonomy) && Number.isFinite(item.organization))), 'La vita interna dà il controllo e la posizione di ogni responsabile');
  assert.ok(view.cadres[0].promise?.weeksLeft >= 0 && view.cadres.some(item => item.area), 'La promessa e l’area del responsabile');
  const html = renderPartyLife({ game });
  assert.ok(html.includes('Controllo del territorio') && html.includes('Con te') && html.includes('Peso politico') && html.includes('candidatura promessa'), 'La scheda dei dirigenti mostra controllo, posizione, peso e promesse');
  const panel = renderCommitteesPanel({ game }, { home: { region: 'Toscana', municipality: 'Siena', provinceCode: '052' } });
  assert.ok(panel.includes('Controllo del territorio') && panel.includes('peso politico'), 'La scheda del territorio mostra il controllo e il peso di ogni responsabile');
  assert.ok(!/undefined|NaN/.test(html + panel), 'Nessun valore rotto nelle schede');
}

// ---------- 13. a whole career with the network: every week, determinism, invariants ----------
{
  const play = seed => {
    let game = makeGame(seed, { rank: 1 });
    let date = START, stats = { ...STATS };
    const trace = [];
    for (let week = 0; week < 150; week++) {
      date = addDays(date, 7);
      const out = advanceWeek({ game, stats, parliament: null }, { currentDate: date, pollDelta: 0 });
      game = out.ctx.game; stats = out.ctx.stats; game.status = 'active';
      // Decisions: the player always takes the first choice of the territory decisions.
      for (const item of [...game.inbox]) {
        const choice = item.defaultChoice;
        try { if (item.templateId === 'capobastone-tessere') game = resolveInboxItem({ game, stats, parliament: null }, { currentDate: date }, item.id, 'verifica').ctx.game; else game = resolveInboxItem({ game, stats, parliament: null }, { currentDate: date }, item.id, choice).ctx.game; } catch { game.inbox = game.inbox.filter(entry => entry.id !== item.id); }
      }
      const control = territorialControl(game.party, { region: 'Toscana' });
      trace.push(control ? control.index : -1);
      assert.ok(control === null || (control.index >= 0 && control.index <= 100), 'Il controllo resta nella scala');
    }
    return { game, trace };
  };
  const a = play('carriera-leaders'), b = play('carriera-leaders');
  assert.deepEqual(a.trace, b.trace, 'Il controllo del territorio è deterministico per seme');
  assert.ok(new Set(a.trace).size > 5, 'Il controllo si muove nel tempo');
  const invariants = checkInvariants({ game: a.game, career: { initialLevel: 'comunale' }, clock: { currentDate: addDays(START, 150 * 7) }, dataset: {}, local: { institutions: [] } });
  const issues = (invariants.issues ?? []).filter(item => !String(item.path ?? '').startsWith('state.world') && !String(item.path ?? '').includes('dataset'));
  assert.deepEqual(issues.filter(item => /game\.party|cadre|committ/i.test(`${item.path} ${item.message}`)), [], 'Gli invarianti del partito reggono');
  assert.ok(a.game.party.life.cadres.length >= 3 && a.game.party.life.cadres.every(item => item.leaderKey !== undefined), 'I dirigenti locali sono seguiti anno dopo anno');
}

// ---------- 14. the real engine: a member with the committees of the ISTAT units, a few years, campaigns included ----------
{
  const { startCareer, playWeek } = await import('./lib/long-run.mjs');
  const run = await startCareer({ seed: 'leaders-store', level: 'comunale', region: 'Toscana' });
  const { store } = run;
  assert.ok(store.getState().game.party.org.committees.length > 20, 'La partita vera ha i comitati delle unità ISTAT');
  const campaigns = new Map();
  let scale = { min: 101, max: -1 }, weeksWithCadres = 0;
  for (let week = 0; week < 52 * 4; week++) {
    playWeek(run);
    const state = store.getState();
    if (state.game.status === 'ended') state.game.status = 'active';
    const control = territorialControl(state.game.party, { region: state.game.place.region });
    if (control) { scale = { min: Math.min(scale.min, control.index), max: Math.max(scale.max, control.index) }; }
    if (state.game.party.life.cadres.length >= 3) weeksWithCadres++;
    const committees = state.campaign?.preparation?.committees;
    if (state.campaign?.id && committees?.control) campaigns.set(state.campaign.id, committees.control.index);
  }
  assert.ok(weeksWithCadres > 150 && scale.min >= 0 && scale.max <= 100, `I responsabili locali ci sono per tutta la partita e il controllo resta nella scala (${scale.min}–${scale.max})`);
  assert.ok(campaigns.size >= 1, 'Le campagne di una partita vera leggono il controllo del territorio del voto');
  // The decisions about the local leaders do not crowd the agenda: a package of memberships at most every twenty weeks.
  const offers = Object.entries(store.getState().game.record?.choices ?? {}).filter(([key]) => key.startsWith('capobastone-tessere.')).reduce((sum, [, count]) => sum + count, 0);
  assert.ok(offers <= Math.ceil(52 * 4 / LEADER_RULES.tessere.partyGapWeeks) + 1, `Pacchetti di tessere non più di uno ogni venti settimane (${offers} in quattro anni)`);
  const result = checkInvariants(store.getState());
  assert.deepEqual((result.issues ?? []).filter(item => /game\.party|cadre|committ/i.test(`${item.path} ${item.message}`)), [], 'Gli invarianti del partito reggono nella partita vera');
}

console.log('Responsabili locali verificati: il peso politico di ogni responsabile (area, fedeltà, malcontento, autonomia) e il controllo del territorio pesano su liste, consenso locale e mobilitazione, organizzazione dei comitati, delegati e peso dell’area, rapporti con le aree, reputazione e promozioni; candidature promesse mantenute alla compilazione delle liste o rotte; un comitato che cambia mano ha un uomo nuovo; pacchetti di tessere, eventi sul territorio, obiettivo e schede.');
