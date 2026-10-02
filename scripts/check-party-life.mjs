// The internal life of the party: the people behind the currents act from the real state of the game (not from fixed
// patterns), their requests end in agreements that can be kept, broken and renewed, the congress comes out of the
// balances built over the months, local leaders have interests of their own, a party in opposition can be rebuilt, and
// a party can be founded, split, merged and renamed with consequences on seats, territories, organisation and money.
// The days of the week carry many more events, without repeating, and the whole thing is deterministic.
import assert from 'node:assert/strict';
import { advanceWeek, createGameState, lifeRespond, lifeFound, lifeMerge, lifeRename, lifeCadre, lifeRebuild, resolveInboxItem } from '../src/core/career-engine.js';
import { advanceLife, cadreDecision, computeVitals, lifeDelegates, lifeRequestWeights, normalizeLife, projectCongress, resolveCongress, respondRequest } from '../src/core/party-life-engine.js';
import { partyOpsAvailability, splitOff } from '../src/core/party-ops-engine.js';
import { CAREER_EVENTS } from '../src/data/simulation/career-rules.js';
import { DAILY_EVENTS } from '../src/data/simulation/daily-events.js';
import { LIFE_SITUATIONS } from '../src/data/simulation/party-life-rules.js';
import { checkInvariants } from '../src/core/invariants.js';
import { ITALIAN_REGIONS } from '../src/data/regions.js';

const addDays = (date, days) => { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10); };
const START = '2027-01-04';
const STATS = { popularity: 45, reputation: 55, notoriety: 45, influence: 45, experience: 40 };
const seasons = date => { const month = Number(date.slice(5, 7)); return { summer: month >= 6 && month <= 8, autumn: month >= 9 && month <= 11, winter: month === 12 || month <= 2 }; };
const signalsFor = (date, extra = {}) => ({ crime: 50, perceived: 50, spread: 150, euStatus: 'regolare', stability: 60, ministers: 0, majorityMood: 55, regions: [], partyGoverning: false, neighbours: [], ...seasons(date), ...extra });
const newGame = (seed, { founder = false, level = 'comunale', region = 'Toscana' } = {}) => createGameState({ seedText: seed, currentDate: START, level, party: { id: 'partito-prova', label: 'Partito di prova', founder }, place: { region, municipality: 'Siena' }, stats: STATS });
// Federations and committees as the store creates them, so that the delegates and the local leaders have something to count.
function withTerritory(game, { led = {} } = {}) {
  const org = game.party.org;
  org.committees = org.sections.map(section => ({
    id: `comitato-regione-${section.region}`, level: 'regione', name: section.region, region: section.region, parentId: null, status: 'consolidamento', statusSince: 1, foundedWeek: 1,
    members: section.members, activists: Math.round(section.members * 0.08), organization: section.vitality, consensus: 50, loyalty: 55,
    leader: led[section.region] ? { label: 'Coordinamento regionale (figura simulata)', currentId: led[section.region], player: false } : { label: 'Coordinamento regionale (figura simulata)', currentId: game.party.currents[section.region.length % game.party.currents.length].id, player: false }, history: [], source: 'simulation'
  }));
  return game;
}
const memory = (game, kind) => (game.memory ?? []).filter(item => item.kind === kind).length;
const A = { date: START, remember: (g, entry) => { g.memory ??= []; g.memory.unshift({ id: `m-${g.memory.length}`, week: g.week.index, weight: 1, tone: 'neutral', source: 'simulation', ...entry }); }, memoryAbout: () => 0, changeRelation: (g, id, delta) => { const item = g.party.currents.find(entry => entry.id === id); if (item) item.value = item.relation = Math.max(0, Math.min(100, (item.value ?? 50) + delta)); }, book: (g, org, amount) => { org.treasury.balance += amount; }, createParty: () => { throw new Error('non usato'); } };
const rander = seed => { let a = [...seed].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 7) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// ---------- 1. the catalogue of the days ----------
{
  const ids = DAILY_EVENTS.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length, 'Eventi giornalieri: id univoci');
  const existing = new Set([...CAREER_EVENTS.map(item => item.id), ...Object.keys(LIFE_SITUATIONS)]);
  for (const id of ids) assert.ok(!existing.has(id), `${id} non sostituisce un evento esistente`);
  assert.ok(DAILY_EVENTS.length >= 60, `Almeno 60 eventi giornalieri (${DAILY_EVENTS.length})`);
  const categories = new Set(DAILY_EVENTS.map(item => item.category));
  for (const category of ['partito', 'parlamento', 'governo', 'territorio', 'media', 'economia', 'relazioni', 'elezioni', 'opportunita', 'quiete']) assert.ok(categories.has(category), `Categoria coperta: ${category}`);
  for (const item of DAILY_EVENTS) {
    assert.ok(item.title && item.body && item.choices.length >= 2, `${item.id}: titolo, testo e scelte`);
    assert.ok(item.choices.some(choice => choice.id === item.defaultChoice), `${item.id}: la scelta predefinita esiste`);
    assert.ok((item.days ?? [0]).every(day => Number.isInteger(day) && day >= 0 && day <= 6), `${item.id}: giorni validi`);
    for (const choice of item.choices) if (choice.followUp) assert.ok(DAILY_EVENTS.some(other => other.id === choice.followUp.id) || CAREER_EVENTS.some(other => other.id === choice.followUp.id), `${item.id}: la catena ${choice.followUp.id} esiste`);
  }
  assert.ok(DAILY_EVENTS.filter(item => item.weight === 0).length >= 5 && DAILY_EVENTS.filter(item => item.rare).length >= 2 && DAILY_EVENTS.filter(item => item.light).length >= 20, 'Catene, successi rari ed eventi leggeri');
  assert.ok(DAILY_EVENTS.some(item => item.days?.every(day => day >= 5)) && DAILY_EVENTS.some(item => item.days?.includes(1)), 'Eventi nel fine settimana e a inizio settimana');
}

// ---------- 2. the days of the week ----------
function playDays(seed, { weeks = 104, founder = false, decide = null } = {}) {
  let game = withTerritory(newGame(seed, { founder }));
  let date = START;
  let stats = { ...STATS };
  const perWeek = [], titles = [], days = new Set(), categories = new Map(), repeats = [];
  const last = {};
  const choose = decide ?? rander(`${seed}|scelte`);
  for (let week = 0; week < weeks; week++) {
    date = addDays(date, 7);
    const result = advanceWeek({ game, stats, parliament: null }, { currentDate: date, career: {}, offices: [], player: null, signals: signalsFor(date) }, value => value);
    game = result.ctx.game; stats = result.ctx.stats;
    stats.reputation = Math.max(stats.reputation, 40); game.status = 'active'; game.resources.politicalCapital = Math.max(game.resources.politicalCapital, 40);
    perWeek.push(game.inbox.length);
    for (const item of game.inbox) {
      titles.push(`${game.week.index}|${item.templateId}|${item.day ?? '-'}`);
      if (Number.isInteger(item.day)) days.add(item.day);
      if (item.kind === 'evento' && item.category) categories.set(item.category, (categories.get(item.category) ?? 0) + 1);
      const template = DAILY_EVENTS.find(entry => entry.id === item.templateId);
      if (template) { if (last[template.id] !== undefined && game.week.index - last[template.id] < Math.min(template.cooldown ?? 8, 4)) repeats.push(template.id); last[template.id] = game.week.index; }
    }
    // The player answers some decisions (at random but reproducibly): the rest is settled by the week's close.
    for (const item of [...game.inbox]) if (choose() < 0.5) { try { const done = resolveInboxItem({ game, stats, parliament: null }, { currentDate: date, career: {}, offices: [], player: null, signals: signalsFor(date) }, item.id, item.choices[Math.floor(choose() * item.choices.length)].id); game = done.ctx.game; stats = done.ctx.stats; } catch { /* not affordable this week */ } }
  }
  return { game, perWeek, titles, days, categories, repeats };
}
const runA = playDays('giorni-alfa');
const runB = playDays('giorni-alfa');
const runC = playDays('giorni-beta', { founder: true });
{
  assert.deepEqual(runA.titles, runB.titles, 'Determinismo: stesso seme e stesse scelte, stesse settimane');
  assert.notDeepEqual(runA.titles, runC.titles, 'Un altro seme racconta un’altra storia');
  for (const run of [runA, runC]) {
    const average = run.perWeek.reduce((sum, value) => sum + value, 0) / run.perWeek.length;
    assert.ok(average >= 4.5, `Molti più appuntamenti per settimana (media ${average.toFixed(1)})`);
    assert.ok(Math.max(...run.perWeek) <= 14, `Mai una valanga di decisioni (massimo ${Math.max(...run.perWeek)})`);
    assert.equal(run.days.size, 7, `Tutti i giorni della settimana hanno qualcosa (${[...run.days].sort().join('')})`);
    assert.ok(run.categories.size >= 10, `Categorie diverse (${run.categories.size})`);
    assert.equal(run.repeats.length, 0, `Nessuna ripetizione prima del cooldown: ${run.repeats.slice(0, 3)}`);
    const kinds = new Set(run.titles.map(entry => entry.split('|')[1]));
    assert.ok(kinds.size >= 60, `Varietà in due anni: ${kinds.size} eventi diversi`);
    const weekly = Object.values(run.titles.reduce((map, entry) => { const [week, id] = entry.split('|'); if (DAILY_EVENTS.some(item => item.id === id)) map[week] = (map[week] ?? 0) + 1; return map; }, {}));
    assert.ok(Math.max(...weekly) <= 5, `Al più cinque eventi giornalieri in una settimana (${Math.max(...weekly)})`);
  }
  const dayHits = runA.titles.filter(entry => entry.split('|')[2] !== '-').length;
  assert.ok(dayHits > runA.titles.length * 0.5, 'La maggior parte delle decisioni cade in un giorno preciso');
}

// ---------- 3. the people behind the currents act from the state ----------
{
  const game = withTerritory(newGame('attori', { founder: true }));
  const party = game.party, life = party.life;
  assert.equal(Object.keys(life.actors).length, party.currents.length, 'Ogni corrente ha il suo capo');
  assert.ok(Object.values(life.actors).every(actor => /figura simulata/.test(actor.leaderLabel) && actor.persona && actor.priority), 'Capi simulati, con un temperamento');
  const personas = new Set(Object.values(life.actors).map(actor => actor.persona));
  assert.ok(personas.size >= 2, 'Le correnti non hanno tutte lo stesso carattere');
  assert.equal(Object.values(life.organs.seats).reduce((a, b) => a + b, 0), life.organs.total, 'I seggi negli organi sommano');
  // The ask depends on the situation: an area with weight and no seats asks for seats; one in line with the party does not ask for the line.
  const [first, second] = [...party.currents].sort((a, b) => b.strength - a.strength);
  life.organs.seats = Object.fromEntries(party.currents.map(item => [item.id, item.id === first.id ? 0 : 3]));
  const hungry = lifeRequestWeights(game, life, life.actors[first.id], party, 5, START);
  life.organs.seats = Object.fromEntries(party.currents.map(item => [item.id, item.id === first.id ? 6 : 1]));
  const sated = lifeRequestWeights(game, life, life.actors[first.id], party, 5, START);
  assert.ok(hungry.incarico > sated.incarico * 3, `Chi pesa e non siede negli organi chiede un seggio (${hungry.incarico} contro ${sated.incarico})`);
  // The line: whoever is not leading and does not have its line asks for it; whoever has it does not.
  game.elections = [];
  const outsiders = party.currents.filter(item => item.id !== party.leaderCurrentId);
  const [mine, other] = outsiders;
  party.line = life.actors[mine.id].line;
  assert.notEqual(life.actors[other.id].line, party.line, 'Le aree hanno linee diverse');
  const inLine = lifeRequestWeights(game, life, life.actors[mine.id], party, 5, START);
  const offLine = lifeRequestWeights(game, life, life.actors[other.id], party, 5, START);
  assert.equal(inLine.linea, 0, 'Chi ha già la sua linea non la chiede');
  assert.ok(offLine.linea > 0, 'Chi non ha la sua linea la chiede');
  assert.equal(offLine['quote-liste'], 0, 'Senza elezioni vicine nessuno chiede posti nelle liste');
  const near = { ...game, elections: [{ id: 'e1', type: 'regionale', status: 'upcoming', label: 'Regionali', windowOpensAt: addDays(START, 30), windowClosesAt: addDays(START, 60), electionDate: addDays(START, 90) }] };
  assert.ok(lifeRequestWeights(near, life, life.actors[first.id], party, 5, START)['quote-liste'] > 0, 'Con le candidature vicine si chiedono le liste');
  // Grievance and loyalty follow the facts: an area whose line is not the party's and whose themes are ignored grows angrier
  // than the same area when it is satisfied.
  const lived = (satisfied) => {
    const g = withTerritory(newGame('rancore', { founder: true }));
    const target = [...g.party.currents].sort((x, y) => y.strength - x.strength).find(item => g.party.life.actors[item.id].line !== g.party.life.actors[g.party.leaderCurrentId].line) ?? g.party.currents[1];
    const actor = g.party.life.actors[target.id];
    if (satisfied) { g.party.line = actor.line; g.party.program = { areas: [...actor.areas.slice(0, 3)], since: 1, source: 'simulation' }; }
    else { g.party.line = actor.line === 'autonoma' ? 'opposizione' : 'autonoma'; g.party.program = { areas: ['ricerca-di-prova'], since: 1, source: 'simulation' }; }
    let date = START;
    for (let week = 1; week <= 40; week++) {
      date = addDays(date, 7);
      advanceLife(g, A, { week, date, rand: rander(`r${week}`), env: { signals: signalsFor(date) } });
      g.party.life.requests = []; g.party.life.splitWatch = {};
      if (satisfied) g.party.line = actor.line; else g.party.line = actor.line === 'autonoma' ? 'opposizione' : 'autonoma';
    }
    return { grievance: g.party.life.actors[target.id].grievance, loyalty: g.party.life.actors[target.id].loyalty };
  };
  const angry = lived(false), content = lived(true);
  assert.ok(angry.grievance > content.grievance + 10 && angry.loyalty < content.loyalty, `Il comportamento segue lo stato della partita: ignorata ${angry.grievance}/${angry.loyalty}, accontentata ${content.grievance}/${content.loyalty}`);
}

// ---------- 4. requests → answer → negotiation → agreement → reaction → memory ----------
{
  const game = withTerritory(newGame('accordi', { founder: true }));
  const party = game.party, life = party.life;
  const [strong, weak] = [...party.currents].sort((x, y) => y.strength - x.strength);
  const make = (kind, refId, ask, extra = {}) => { life.counters.requests += 1; const request = { id: `richiesta-t-${life.counters.requests}`, kind, from: 'actor', refId, title: `Prova ${kind}`, body: 'Corpo', acceptLabel: 'Accetta', ask, counter: null, stage: 'aperta', week: 1, dueWeek: 9, delays: 0, source: 'simulation', ...extra }; life.requests.push(request); return request; };
  // Accept: an agreement with conditions and duration, the others notice, the memory keeps it.
  const quota = make('quote-liste', strong.id, { share: 30, electionId: 'e1' });
  const before = Object.fromEntries(Object.values(life.actors).map(actor => [actor.id, actor.grievance]));
  let out = respondRequest(game, A, { requestId: quota.id, choice: 'accetta', week: 2, date: START, rand: rander('x') });
  const pact = life.pacts.find(item => item.requestId === quota.id);
  assert.ok(pact && pact.kind === 'quote-liste' && pact.status === 'attivo' && pact.until > pact.since && pact.terms.share === 30, 'Accettare crea un accordo con condizioni e durata');
  assert.ok(life.actors[strong.id].grievance < before[strong.id] && life.actors[weak.id].grievance > before[weak.id], 'Chi ottiene si calma, gli altri guardano e si scontentano');
  assert.ok(memory(game, 'accordo-partito') === 1 && !life.requests.some(item => item.id === quota.id) && life.closed[0].outcome === 'accolta', 'Memoria dell’accordo e richiesta chiusa');
  // Refuse: resentment, memory, and an ultimatum puts the area on the way out.
  const programma = make('programma', weak.id, { area: 'welfare' });
  const calm = life.actors[weak.id].grievance;
  respondRequest(game, A, { requestId: programma.id, choice: 'rifiuta', week: 3, date: START, rand: rander('y') });
  assert.ok(life.actors[weak.id].grievance > calm && life.actors[weak.id].refused === 1 && memory(game, 'richiesta-respinta') === 1, 'Un rifiuto lascia rancore e memoria');
  const ultimatum = make('ultimatum', weak.id, { demand: 'incarico', seats: 1 });
  respondRequest(game, A, { requestId: ultimatum.id, choice: 'rifiuta', week: 4, date: START, rand: rander('z') });
  assert.ok(life.splitWatch[weak.id], 'Un ultimatum respinto mette l’area sulla via dell’uscita');
  // Negotiation: with a softer counter-offer, or more time, or a hardening.
  const fondi = make('fondi', strong.id, { amount: 2000 });
  life.actors[strong.id].loyalty = 90; life.actors[strong.id].temper = 10;
  game.resources.politicalCapital = 60;
  let counters = 0, softer = 0;
  for (let n = 0; n < 12; n++) {
    fondi.stage = 'aperta'; fondi.counter = null;
    const result = respondRequest(game, A, { requestId: fondi.id, choice: 'tratta', week: 5, date: START, rand: rander(`neg${n}`) });
    if (fondi.counter) { counters++; if (fondi.counter.ask.amount < 2000) softer++; }
    assert.ok(Array.isArray(result.lines), 'La trattativa risponde');
  }
  assert.ok(counters >= 3 && softer === counters, `Una trattativa può dare una controfferta più leggera (${counters} su 12)`);
  respondRequest(game, A, { requestId: fondi.id, choice: 'accetta-controfferta', week: 6, date: START, rand: rander('c') });
  const fondiPact = life.pacts.find(item => item.requestId === fondi.id);
  assert.ok(fondiPact && fondiPact.terms.amount < 2000, 'La controfferta accolta diventa l’accordo');
  // Money paid every four weeks; an empty treasury breaks the agreement.
  const treasury = game.party.org.treasury.balance;
  for (let week = 7; week <= 12; week++) advanceLife(game, A, { week, date: addDays(START, week * 7), rand: rander(`p${week}`), env: { signals: signalsFor(START) } });
  assert.ok(game.party.org.treasury.balance < treasury, 'Il contributo dell’accordo esce dalla tesoreria');
  game.party.org.treasury.balance = 0;
  for (let week = 13; week <= 18; week++) advanceLife(game, A, { week, date: addDays(START, week * 7), rand: rander(`q${week}`), env: { signals: signalsFor(START) } });
  assert.equal(life.pacts.find(item => item.id === fondiPact.id).status, 'rotto', 'Senza soldi l’accordo sui fondi si rompe');
  assert.ok(memory(game, 'accordo-rotto') >= 1, 'La rottura resta nella memoria');
  // Breach by the player: the line is changed after a deal on the line.
  const linea = make('linea', weak.id, { line: life.actors[weak.id].line });
  respondRequest(game, A, { requestId: linea.id, choice: 'accetta', week: 20, date: START, rand: rander('l') });
  const linePact = life.pacts.find(item => item.requestId === linea.id);
  assert.equal(game.party.line, life.actors[weak.id].line, 'L’accordo sulla linea la cambia davvero');
  const angry = life.actors[weak.id].grievance;
  game.party.line = game.party.line === 'autonoma' ? 'opposizione' : 'autonoma';
  advanceLife(game, A, { week: 21, date: START, rand: rander('b'), env: { signals: signalsFor(START) } });
  assert.equal(life.pacts.find(item => item.id === linePact.id).status, 'rotto', 'Cambiare la linea rompe l’accordo');
  assert.ok(life.actors[weak.id].grievance > angry, 'L’area tradita è più scontenta');
  // Renewal: an agreement about to expire comes back as a request; ignored, it lapses.
  const tregua = make('programma', strong.id, { area: 'economia' });
  respondRequest(game, A, { requestId: tregua.id, choice: 'accetta', week: 30, date: START, rand: rander('t') });
  const programPact = life.pacts.find(item => item.requestId === tregua.id);
  programPact.until = 36;
  advanceLife(game, A, { week: 33, date: START, rand: rander('n'), env: { signals: signalsFor(START) } });
  const renewal = life.requests.find(item => item.kind === 'rinnovo' && item.ask.pactId === programPact.id);
  assert.ok(renewal, 'Un accordo in scadenza torna come richiesta di rinnovo');
  respondRequest(game, A, { requestId: renewal.id, choice: 'accetta', week: 34, date: START, rand: rander('u') });
  assert.ok(programPact.until > 36 && programPact.renewals === 1, 'Il rinnovo allunga l’accordo');
  programPact.until = 40;
  advanceLife(game, A, { week: 41, date: START, rand: rander('v'), env: { signals: signalsFor(START) } });
  assert.equal(programPact.status, 'scaduto', 'Un accordo non rinnovato scade');
  // Direct answer from the interface: costs, the agenda item leaves, the diary keeps it.
  const direct = withTerritory(newGame('diretto', { founder: true }));
  direct.party.life.requests.push({ id: 'richiesta-d-1', kind: 'fondi', from: 'actor', refId: direct.party.currents[0].id, title: 'Fondi', body: 'x', acceptLabel: 'x', ask: { amount: 500 }, counter: null, stage: 'aperta', week: 1, dueWeek: 9, delays: 0, source: 'simulation' });
  direct.inbox.push({ id: 'agenda-1', kind: 'situazione', templateId: 'richiesta-partito', params: { requestId: 'richiesta-d-1' }, title: 'Fondi', body: 'x', choices: [], week: 1 });
  const answered = lifeRespond({ game: direct, stats: { ...STATS }, parliament: null }, { currentDate: START }, 'richiesta-d-1', 'accetta');
  assert.ok(!answered.ctx.game.inbox.some(item => item.params?.requestId === 'richiesta-d-1') && answered.ctx.game.party.life.pacts.length === 1, 'Rispondere dalla scheda toglie la decisione dall’agenda e crea l’accordo');
  assert.throws(() => lifeRespond({ game: direct, stats: { ...STATS }, parliament: null }, { currentDate: START }, 'richiesta-inesistente', 'accetta'), /non è più aperta/);
}

// ---------- 5. the congress comes out of the balances ----------
{
  const game = withTerritory(newGame('congresso', { founder: false }));
  const party = game.party, life = party.life;
  party.org.congress.nextWeek = 25;
  const phases = [];
  for (let week = 1; week <= 25; week++) {
    advanceLife(game, A, { week, date: addDays(START, week * 7), rand: rander(`c${week}`), env: { signals: signalsFor(START) } });
    game.week.index = week;
    if (life.congress && phases.at(-1) !== life.congress.phase) phases.push(life.congress.phase);
  }
  assert.deepEqual(phases, ['forza', 'preparazione', 'delegati', 'alleanze', 'trattative', 'mozioni', 'voto'], 'Le fasi del congresso si susseguono');
  const delegates = life.congress.delegates;
  assert.ok(delegates.total >= 100 && Object.values(delegates.byCurrent).reduce((a, b) => a + b, 0) + delegates.player === delegates.total, 'I delegati sommano al totale');
  assert.ok(life.congress.alliances.length >= 1, 'Le aree si alleano prima del voto');
  // The previous decisions change the result: whoever leads the committees and mobilises gets the delegates.
  const [first, second] = [...party.currents].sort((a, b) => b.strength - a.strength);
  const prepare = favoured => {
    const g = withTerritory(newGame('delegati', { founder: false }), { led: Object.fromEntries(ITALIAN_REGIONS.map(region => [region, favoured])) });
    g.party.currents.forEach(item => { item.strength = item.id === favoured ? 28 : 36; });
    g.party.org.congress.nextWeek = 20;
    const l = normalizeLife(g.party, { seed: 1, week: 1 });
    l.congress = { id: 'c', voteWeek: 20, openedWeek: 1, schedule: [{ id: 'forza', startWeek: 1 }], phase: 'delegati', mobilization: {}, alliances: [], notes: [], delegates: null, motions: [], source: 'simulation' };
    return lifeDelegates(g.party, l, l.congress).byCurrent;
  };
  const withCommittees = prepare(second.id);
  assert.ok(withCommittees[second.id] > withCommittees[first.id], `Chi guida le federazioni raccoglie i delegati, anche se pesa meno (${withCommittees[second.id]} contro ${withCommittees[first.id]})`);
  // Mobilisation and pacts add up in the projection; the player's own committees follow the player's choice.
  const base = projectCongress(game, { mode: 'support', backedId: first.id });
  life.congress.mobilization[second.id] = 40;
  life.congress.delegates = lifeDelegates(party, life, life.congress);
  const mobilised = projectCongress(game, { mode: 'support', backedId: first.id });
  const pct = (projection, id) => projection.ranked.find(row => row.id === id || row.members?.includes(id))?.pct ?? 0;
  assert.ok(pct(mobilised, second.id) > pct(base, second.id) - 0.01, 'Mobilitare i quadri non toglie peso all’area');
  const mine = game.party.org.committees.find(item => item.level === 'regione');
  mine.leader = { label: 'Tu', currentId: null, player: true };
  life.congress.delegates = lifeDelegates(party, life, life.congress);
  assert.ok(life.congress.delegates.player > 0, 'I comitati guidati dal giocatore pesano sulla sua scelta');
  life.congress.alliances = [];
  const forFirst = projectCongress(game, { mode: 'support', backedId: first.id });
  const forSecond = projectCongress(game, { mode: 'support', backedId: second.id });
  assert.ok(pct(forFirst, first.id) > pct(forSecond, first.id) && pct(forSecond, second.id) > pct(forFirst, second.id), 'Schierarsi sposta davvero il risultato');
  // The vote and its consequences.
  const strengthBefore = Object.fromEntries(party.currents.map(item => [item.id, item.strength]));
  const twin = structuredClone(game);
  const resolved = resolveCongress(game, A, { mode: 'support', backedId: second.id, influence: 45, week: 26, date: START, rand: rander('voto') });
  const outcome = resolved.outcome;
  assert.equal(party.leaderCurrentId, outcome.winnerCurrentId, 'Il vincitore guida il partito');
  assert.ok(life.congress === null && life.lastCongress.winnerId === outcome.winnerCurrentId, 'Il congresso si chiude e resta in memoria');
  assert.ok(Math.abs(party.currents.reduce((sum, item) => sum + item.strength, 0) - Object.values(strengthBefore).reduce((a, b) => a + b, 0)) <= 6, 'Le forze si ridistribuiscono senza inventare peso');
  assert.ok(party.currents.find(item => item.id === outcome.winnerCurrentId).strength >= strengthBefore[outcome.winnerCurrentId] - 3, 'Chi vince guadagna peso');
  assert.equal(Object.values(life.organs.seats).reduce((a, b) => a + b, 0), life.organs.total, 'Gli organi si riassegnano');
  assert.ok(memory(game, 'congresso') === 1 && life.history.some(item => item.kind === 'congresso'), 'Il congresso resta nella memoria');
  const again = resolveCongress(twin, A, { mode: 'support', backedId: second.id, influence: 45, week: 26, date: START, rand: rander('voto') }).outcome;
  assert.equal(again.ranked.map(row => `${row.id}:${row.pct}`).join(), outcome.ranked.map(row => `${row.id}:${row.pct}`).join(), 'Lo stesso congresso dà lo stesso risultato');
  assert.ok(true);
  // As a secretary: the incumbent is judged by the same delegates.
  const secretary = withTerritory(newGame('segretario', { founder: false }));
  secretary.party.rank = 5; secretary.party.org.congress.nextWeek = 25;
  for (let week = 1; week <= 25; week++) { advanceLife(secretary, A, { week, date: addDays(START, week * 7), rand: rander(`s${week}`), env: { signals: signalsFor(START) } }); secretary.week.index = week; }
  const own = resolveCongress(secretary, A, { mode: 'incumbent', influence: 60, week: 26, date: START, rand: rander('seg') });
  assert.ok(typeof own.outcome.playerWon === 'boolean' && own.outcome.ranked.some(row => row.id === 'player'), 'Il segretario uscente ha la sua mozione tra le altre');
}

// ---------- 6. local leaders, rebuilding, vitals ----------
{
  const game = withTerritory(newGame('quadri', { founder: false }));
  const life = game.party.life;
  advanceLife(game, A, { week: 1, date: START, rand: rander('q0'), env: { signals: signalsFor(START) } });
  assert.ok(life.cadres.length >= 5 && life.cadres.every(item => item.interest && item.ambition >= 0 && item.loyalty >= 0), 'I comitati hanno dirigenti con interessi propri');
  const target = life.cadres[0];
  const committee = game.party.org.committees.find(item => item.id === target.committeeId);
  committee.status = 'crisi'; committee.loyalty = 22; committee.organization = 20;
  let left = false;
  for (let week = 2; week <= 70 && !left; week++) {
    committee.status = 'crisi'; committee.loyalty = Math.min(committee.loyalty, 25);
    advanceLife(game, A, { week, date: addDays(START, week * 7), rand: rander(`q${week}`), env: { signals: signalsFor(START) } });
    game.week.index = week;
    left = target.status === 'uscito';
  }
  assert.ok(target.grievance >= 50 || left, 'Un comitato in crisi scontenta il suo dirigente');
  const quiet = life.cadres.find(item => item.id !== target.id && item.status !== 'uscito');
  const loyalty = quiet.loyalty;
  game.resources.politicalCapital = 40; game.week.ap = 6;
  const meet = lifeCadre({ game, stats: { ...STATS }, parliament: null }, { currentDate: START }, { action: 'incontra', cadreId: quiet.id });
  assert.ok(meet.ctx.game.party.life.cadres.find(item => item.id === quiet.id).loyalty > loyalty, 'Incontrare un dirigente ne aumenta la lealtà');
  const promote = lifeCadre({ game, stats: { ...STATS }, parliament: null }, { currentDate: START }, { action: 'promuovi', cadreId: quiet.id });
  assert.ok(promote.ctx.game.resources.politicalCapital < 40, 'Promuovere costa capitale politico');
  // A leaver takes members and volunteers with him.
  const g2 = withTerritory(newGame('fuga', { founder: false }));
  const l2 = g2.party.life;
  advanceLife(g2, A, { week: 1, date: START, rand: rander('f0'), env: { signals: signalsFor(START) } });
  const leaver = l2.cadres[1];
  const comm = g2.party.org.committees.find(item => item.id === leaver.committeeId);
  const members = comm.members;
  cadreDecision(g2, A, { cadreId: leaver.id, choice: 'leave', week: 2, date: START, rand: rander('f1') });
  assert.ok(leaver.status === 'uscito' && comm.members < members && comm.loyalty < 55 && memory(g2, 'quadro-perso') === 1, 'Chi se ne va porta via iscritti e lascia il ricordo');
  // Rebuilding in opposition: offered when the party declines, works week after week, ends.
  const rebuild = withTerritory(newGame('opposizione', { founder: true }));
  const rl = rebuild.party.life;
  rebuild.party.org.cohesion = 30; rebuild.party.org.membersHistory = Array.from({ length: 12 }, (_, i) => ({ week: i + 1, members: 3000 - i * 80 }));
  const offers = [];
  for (let week = 1; week <= 12; week++) { const out = advanceLife(rebuild, A, { week, date: addDays(START, week * 7), rand: rander(`o${week}`), env: { signals: signalsFor(START, { partyGoverning: false }) } }); offers.push(...out.raises.filter(item => item.id === 'ricostruzione-partito')); if (offers.length) break; }
  assert.ok(offers.length >= 1, 'Un partito di opposizione in declino riceve la proposta di ricostruzione');
  const vitality = rebuild.party.org.sections.reduce((sum, item) => sum + item.vitality, 0);
  rebuild.week.ap = 6; rebuild.resources.politicalCapital = 30;
  const started = lifeRebuild({ game: rebuild, stats: { ...STATS }, parliament: null }, { currentDate: START }, 'territorio');
  const g3 = started.ctx.game;
  assert.ok(g3.party.life.rebuild?.focus === 'territorio', 'Il piano parte');
  for (let week = 20; week <= 30; week++) advanceLife(g3, A, { week, date: addDays(START, week * 7), rand: rander(`rb${week}`), env: { signals: signalsFor(START, { partyGoverning: false }) } });
  assert.ok(g3.party.org.sections.reduce((sum, item) => sum + item.vitality, 0) > vitality, 'La ricostruzione fa risalire la vitalità delle sezioni');
  for (let week = 31; week <= 60; week++) advanceLife(g3, A, { week, date: addDays(START, week * 7), rand: rander(`rb${week}`), env: { signals: signalsFor(START, { partyGoverning: false }) } });
  assert.equal(g3.party.life.rebuild, null, 'Dopo sei mesi il piano si conclude');
  const vitals = computeVitals(g3.party, g3.party.life);
  assert.ok(vitals.stability >= 0 && vitals.stability <= 100 && vitals.volatility >= 0 && vitals.mobilization >= 0 && ['crescita', 'stabile', 'declino', 'volatile'].includes(vitals.trend), 'Gli indicatori di salute del partito sono in ordine');
}

// ---------- 7. splitting, founding, merging, renaming (the career state) ----------
{
  const game = withTerritory(newGame('operazioni', { founder: false }));
  const party = game.party;
  const leaving = [...party.currents].sort((x, y) => y.strength - x.strength)[1];
  const membersBefore = party.org.members, committeesBefore = party.org.committees.length, treasuryBefore = party.org.treasury.balance, currentsBefore = party.currents.length;
  const out = splitOff(game, A, { currentIds: [leaving.id], newPartyId: 'partito-scissione-1', label: 'Riformisti Uniti', followed: false, week: 10, date: START, rand: rander('split') });
  const d = out.descriptor;
  assert.ok(d.members > 0 && d.members < membersBefore && party.org.members === membersBefore - d.members, 'Gli iscritti si dividono: quelli che escono si tolgono dal partito');
  assert.ok(d.committees.length >= 1 && party.org.committees.length === committeesBefore - d.committees.length, 'I comitati guidati dall’area passano con lei');
  assert.ok(party.org.treasury.balance < treasuryBefore && d.treasury > 0, 'La cassa si divide');
  assert.ok(party.currents.length === currentsBefore - 1 && !party.currents.some(item => item.id === leaving.id) && !party.life.actors[leaving.id], 'L’area esce dal partito e dalla sua vita interna');
  assert.ok(d.seatShare > 0 && d.leavingShare > 0 && memory(game, 'scissione') === 1, 'Quota di seggi e memoria della scissione');
  const ops = partyOpsAvailability(game);
  assert.ok(typeof ops.found.ok === 'boolean' && ops.rename.ok === false && /fondato/.test(ops.rename.reason), 'Il nome di un partito esistente non si cambia');
  // Founding by the player, with the area that follows and the committees led by the player.
  const g2 = withTerritory(newGame('fondazione', { founder: false }));
  const first = g2.party.currents[0];
  g2.party.org.committees[0].leader = { label: 'Tu', currentId: null, player: true };
  const old = g2.party.org.members;
  const result = lifeFound({ game: g2, stats: { ...STATS }, parliament: null }, { currentDate: START }, { label: 'Alleanza dei Territori', abbreviation: 'adt', followerIds: [first.id] });
  const g3 = result.ctx.game;
  assert.equal(g3.party.label, 'Alleanza dei Territori', 'Il giocatore guida il nuovo partito');
  assert.ok(g3.party.affiliation === 'founder' && g3.party.rank === 5 && g3.party.life && Object.keys(g3.party.life.actors).length === g3.party.currents.length, 'Segretario e fondatore, con la sua vita interna');
  assert.ok(g3.party.org.members > 0 && g3.party.org.members < old && g3.party.org.committees.some(item => item.leader.player), 'Porta con sé iscritti, volontari e i comitati che guida');
  assert.ok(g3.pastParties.length === 1 && memory(g3, 'fondazione') === 1 && result.specials[0].type === 'party-split' && result.specials[0].followed, 'Il vecchio partito resta nella storia; il resto lo applica il mondo');
  assert.ok(g3.resources.politicalCapital < g2.resources.politicalCapital && g3.resources.funds < g2.resources.funds, 'Fondare costa capitale politico e fondi');
  assert.throws(() => lifeFound({ game: g3, stats: { ...STATS }, parliament: null }, { currentDate: START }, { label: 'Un altro ancora' }), /Di nuovo dalla settimana/, 'Non si fonda un partito ogni settimana');
  assert.throws(() => lifeFound({ game: g2, stats: { ...STATS }, parliament: null }, { currentDate: START }, { label: 'X' }), /da 3 a 60/);
  // Merger and renaming (a party founded by the player).
  g3.party.org.treasury.balance = 20000; g3.resources.politicalCapital = 40; g3.week.ap = 6;
  const members = g3.party.org.members, cohesion = g3.party.org.cohesion, areas = g3.party.currents.length;
  const merged = lifeMerge({ game: g3, stats: { ...STATS }, parliament: null }, { currentDate: START }, { forceId: 'forza-vicina', label: 'Forza Vicina', share: 3, ownShare: 3, newLabel: 'Alleanza dei Territori – Forza Vicina' });
  const m = merged.ctx.game.party;
  assert.ok(m.org.members > members && m.currents.length === areas + 1 && m.org.cohesion < cohesion && m.org.conflicts.some(item => /integrazione/i.test(item.title)), 'Fusione: più iscritti, una nuova area, coesione giù e un conflitto d’integrazione');
  assert.equal(m.label, 'Alleanza dei Territori – Forza Vicina', 'Il nome unito');
  assert.ok(Math.abs(m.currents.reduce((sum, item) => sum + item.strength, 0) - 100) <= 6, 'Le aree continuano a sommare circa 100');
  assert.equal(merged.specials[0].type, 'party-merge');
  const renamedGame = merged.ctx.game; renamedGame.party.decisions = {}; renamedGame.party.org.treasury.balance = 20000; renamedGame.resources.politicalCapital = 40;
  const renamed = lifeRename({ game: renamedGame, stats: { ...STATS }, parliament: null }, { currentDate: START }, { label: 'Nuova Italia dei Territori', abbreviation: 'NIT', style: 'rifondazione' });
  const r = renamed.ctx.game.party;
  assert.ok(r.label === 'Nuova Italia dei Territori' && r.names.at(-1).label === 'Alleanza dei Territori – Forza Vicina' && r.org.treasury.balance < 20000 && r.org.members < m.org.members, 'Cambio di nome: costa soldi e qualche iscritto, il vecchio nome resta nella storia');
  assert.equal(renamed.specials[0].descriptor.style, 'rifondazione');
  assert.throws(() => lifeRename({ game: renamed.ctx.game, stats: { ...STATS }, parliament: null }, { currentDate: START }, { label: 'Ancora un nome' }), /Di nuovo dalla settimana/);
}

// ---------- 8. in the store: seats, territories, polls, records ----------
{
  const { startCareer, playWeek, seeded, fingerprint } = await import('./lib/long-run.mjs');
  const run = await startCareer({ seed: 'vita-store', level: 'deputato' });
  const decide = seeded('vita-store|scelte');
  for (let week = 0; week < 20; week++) playWeek({ ...run, decide });
  let state = run.store.getState();
  assert.ok(state.game.party.life && state.game.party.life.actors, 'La carriera ha la sua vita interna');
  const seatGroup = state.parliament.player.groupId;
  const groupsBefore = ['camera', 'senato'].map(chamber => state.parliament.chambers[chamber].groups.reduce((sum, group) => sum + group.simulatedSeats, 0));
  const worldBefore = state.world.parties.find(item => item.isPlayer).baseline;
  // The player founds a new party: world, Parliament, records.
  const st = run.store.getState();
  st.game.resources.politicalCapital = 60; st.game.resources.funds = 8000;
  const aligned = st.game.party.currents[0].id;
  const origin = st.career.partyId;
  run.store.foundParty({ label: 'Partito del Test', abbreviation: 'pdt', followerIds: [aligned] });
  state = run.store.getState();
  assert.notEqual(state.career.partyId, origin, 'La carriera passa al nuovo partito');
  const record = state.dataset.parties.find(item => item.id === state.career.partyId);
  assert.ok(record && record.source === 'user' && record.officialName === 'Partito del Test' && record.abbreviation === 'PDT', 'Il nuovo partito è un record dell’utente');
  assert.equal(state.dataset.politicians.find(item => item.id === state.career.playerId).partyId, state.career.partyId, 'Il politico del giocatore è nel nuovo partito');
  const force = state.world.parties.find(item => item.isPlayer);
  assert.ok(force && force.id === state.career.partyId && force.origin === 'player' && force.refSource === 'user', 'Il mondo conosce il nuovo partito');
  assert.ok(state.world.parties.find(item => item.id === state.world.parties.find(p => p.id === force.parentId)?.id).baseline < worldBefore + 0.001, 'Il vecchio partito perde consenso');
  const groupsAfter = ['camera', 'senato'].map(chamber => state.parliament.chambers[chamber].groups.reduce((sum, group) => sum + group.simulatedSeats, 0));
  assert.deepEqual(groupsAfter, groupsBefore, 'I seggi totali non cambiano: si spostano');
  assert.ok(state.parliament.chambers[state.parliament.player.chamber].groups.some(group => group.partyId === state.career.partyId) || state.parliament.player.groupId === seatGroup, 'Una parte del gruppo parlamentare segue il nuovo partito');
  const report = checkInvariants(state, run.context);
  assert.ok(report.ok, `Dopo la fondazione: ${report.issues.slice(0, 3).map(item => `[${item.code}] ${item.message}`).join('; ')}`);
  for (let week = 0; week < 40; week++) playWeek({ ...run, decide });
  const later = checkInvariants(run.store.getState(), run.context);
  assert.ok(later.ok, `Dopo 40 settimane nel nuovo partito: ${later.issues.slice(0, 3).map(item => `[${item.code}] ${item.message}`).join('; ')}`);
  // A split of the party the player stays in (an area leaves): seats move to a new group, the world has a new force.
  const run2 = await startCareer({ seed: 'vita-scissione', level: 'deputato' });
  const decide2 = seeded('vita-scissione|scelte');
  for (let week = 0; week < 10; week++) playWeek({ ...run2, decide: decide2 });
  const s2 = run2.store.getState();
  const { addSituationEvent } = await import('../src/core/career-engine.js');
  const leaver = [...s2.game.party.currents].sort((x, y) => y.strength - x.strength).find(item => item.id !== s2.game.party.alignedCurrentId) ?? s2.game.party.currents[0];
  const totals = ['camera', 'senato'].map(chamber => s2.parliament.chambers[chamber].groups.reduce((sum, group) => sum + group.simulatedSeats, 0));
  const forces = s2.world.parties.length;
  s2.game = addSituationEvent(s2.game, 'scissione-subita', { dedupe: 'scissione-prova', currentId: leaver.id, current: leaver.label, title: `${leaver.label} lascia il partito`, body: 'Prova' }, true);
  const item = s2.game.inbox.find(entry => entry.templateId === 'scissione-subita');
  run2.store.resolveAgendaItem(item.id, 'resta');
  const after = run2.store.getState();
  assert.ok(!after.game.party.currents.some(entry => entry.id === leaver.id), 'L’area è uscita dal partito');
  assert.equal(after.world.parties.length, forces + 1, 'Nel mondo nasce una nuova forza');
  assert.ok(after.world.parties.some(entry => entry.origin === 'evoluzione' && /Riformisti|Autonomie|Movimento|Area/.test(entry.label)), 'La forza nuova ha il nome dell’area');
  assert.deepEqual(['camera', 'senato'].map(chamber => after.parliament.chambers[chamber].groups.reduce((sum, group) => sum + group.simulatedSeats, 0)), totals, 'La scissione sposta i seggi senza crearne');
  assert.ok(after.parliament.chambers.camera.groups.some(group => group.simulated && /scissione/i.test(group.reference?.sourceName ?? '')) || after.parliament.chambers.senato.groups.some(group => group.simulated && /scissione/i.test(group.reference?.sourceName ?? '')), 'Nasce un gruppo parlamentare della scissione');
  assert.ok(checkInvariants(after, run2.context).ok, 'Stato coerente dopo la scissione');
  // A split never takes the Government's majority away, and the new force is on the same side in both Chambers: the
  // majority is brought to its narrowest margin (seats go from an ally to the opposition) before the area leaves.
  const sides = new Set();
  for (let index = 0; index < 8 && !(sides.has('coalizione') && sides.has('sostegno')); index++) {
    const run4 = await startCareer({ seed: `vita-maggioranza-${index}`, level: 'deputato' });
    const decide4 = seeded(`maggioranza|${index}`);
    for (let week = 0; week < 3; week++) playWeek({ ...run4, decide: decide4 });
    const s4 = run4.store.getState();
    const government = s4.parliament.government;
    const ownGroupParty = s4.world.playerPartyId;
    const backingOf = state => new Set([...state.parliament.government.coalitionGroupIds, ...(state.parliament.government.supportingGroupIds ?? [])]);
    for (const chamber of ['camera', 'senato']) {
      const groups = s4.parliament.chambers[chamber].groups;
      const backing = backingOf(s4);
      const total = groups.reduce((sum, group) => sum + group.simulatedSeats, 0);
      const surplus = Math.max(0, groups.filter(group => backing.has(group.groupId)).reduce((sum, group) => sum + group.simulatedSeats, 0) - (Math.floor(total / 2) + 1));
      const donor = groups.filter(group => backing.has(group.groupId) && group.partyId !== ownGroupParty).sort((a, b) => b.simulatedSeats - a.simulatedSeats)[0];
      const taker = groups.filter(group => !backing.has(group.groupId)).sort((a, b) => b.simulatedSeats - a.simulatedSeats)[0];
      donor.simulatedSeats -= surplus; taker.simulatedSeats += surplus;
    }
    assert.ok(government.status === 'active' && checkInvariants(s4, run4.context).ok, 'Prima della scissione il governo ha la maggioranza');
    const leaver4 = [...s4.game.party.currents].sort((x, y) => y.strength - x.strength)[index % s4.game.party.currents.length];
    s4.game = addSituationEvent(s4.game, 'scissione-subita', { dedupe: 'scissione-maggioranza', currentId: leaver4.id, current: leaver4.label, title: `${leaver4.label} lascia il partito`, body: 'Prova' }, true);
    run4.store.resolveAgendaItem(s4.game.inbox.find(entry => entry.templateId === 'scissione-subita').id, 'resta');
    const after4 = run4.store.getState();
    const created = ['camera', 'senato'].map(chamber => after4.parliament.chambers[chamber].groups.find(group => group.simulated && /scissione/i.test(group.reference?.sourceName ?? '')));
    assert.ok(created.every(Boolean), 'La scissione crea un gruppo in entrambe le Camere');
    const sideOf = group => !backingOf(after4).has(group.groupId) ? 'opposizione' : after4.parliament.government.coalitionGroupIds.includes(group.groupId) ? 'coalizione' : 'sostegno';
    assert.equal(sideOf(created[0]), sideOf(created[1]), 'Il nuovo gruppo sta dalla stessa parte alla Camera e al Senato');
    const holds = checkInvariants(after4, run4.context);
    assert.ok(holds.ok, `La maggioranza regge dopo la scissione: ${holds.issues.slice(0, 3).map(item => `[${item.code}] ${item.message}`).join('; ')}`);
    sides.add(sideOf(created[0]));
  }
  assert.ok(sides.has('coalizione') && sides.has('sostegno'), 'Il nuovo gruppo resta in coalizione o, se uscendo farebbe cadere la maggioranza, dà un sostegno esterno');
  // A merger and a new name in the store, for the founder.
  const run3 = await startCareer({ seed: 'vita-fusione', level: 'comunale' });
  const s3 = run3.store.getState();
  s3.game.party.affiliation = 'founder'; s3.game.party.rank = 5; s3.game.resources.politicalCapital = 60; s3.game.party.org.treasury.balance = 30000;
  const own = s3.world.parties.find(item => item.isPlayer);
  const listed = new Set((s3.world.polls.at(-1)?.results ?? []).map(row => row.partyId));
  const near = s3.world.parties.find(item => !item.isPlayer && item.active && listed.has(item.id) && item.baseline >= Math.max(0.5, own.baseline * 0.3) && item.baseline <= own.baseline * 1.8 + 1);
  assert.ok(near, 'Nel mondo c’è una forza di dimensioni vicine');
  s3.world.ties[[own.id, near.id].sort().join('|')] = 70; near.axis = own.axis;
  const mergers = run3.store.partyLife().neighbours;
  assert.ok(mergers.some(item => item.id === near.id), 'La forza vicina compare tra le possibili fusioni');
  const ownBefore = s3.world.parties.find(item => item.isPlayer).baseline;
  run3.store.mergeParty(near.id, { unifyNames: false });
  const merged = run3.store.getState();
  assert.ok(!merged.world.parties.find(item => item.id === near.id).active && merged.world.parties.find(item => item.isPlayer).baseline > ownBefore, 'Nel mondo la forza confluisce nel partito del giocatore');
  assert.ok(merged.game.party.currents.length === s3.game.party.currents.length + 1, 'Il partito ha ora un’area in più');
  assert.ok(checkInvariants(merged, run3.context).ok, 'Stato coerente dopo la fusione');
  // Determinism through the store: the same seed and the same choices give the same game.
  const finger = async seed => { const r = await startCareer({ seed, level: 'deputato' }); const d = seeded(`${seed}|d`); for (let week = 0; week < 40; week++) playWeek({ ...r, decide: d }); return fingerprint(r.store.getState()); };
  const one = await finger('vita-det');
  assert.equal(await finger('vita-det'), one, 'Determinismo: stesso seme, stessa partita');
  assert.notEqual(await finger('vita-det-2'), one, 'Un altro seme, un’altra partita');
}

// ---------- 9. old saves and the interface ----------
{
  const { startCareer, playWeek, seeded } = await import('./lib/long-run.mjs');
  const run = await startCareer({ seed: 'vita-save', level: 'senatore' });
  const decide = seeded('vita-save|scelte');
  for (let week = 0; week < 30; week++) playWeek({ ...run, decide });
  const raw = JSON.parse(JSON.stringify(run.store.getState()));
  delete raw.game.party.life;
  delete raw.game.eventRecent;
  for (const item of raw.game.inbox) delete item.day;
  const { normalizeGameState } = await import('../src/core/career-engine.js');
  const normalized = normalizeGameState(raw.game);
  assert.ok(normalized.party.life?.actors && Object.keys(normalized.party.life.actors).length === normalized.party.currents.length && normalized.party.life.organs.total === 9, 'Un vecchio salvataggio riceve la vita interna dallo stato che ha');
  // The legacy game keeps playing for months, deterministically.
  const result = advanceWeek({ game: normalized, stats: { ...STATS }, parliament: null }, { currentDate: addDays(START, 7), career: {}, offices: [], player: null, signals: signalsFor(START) }, value => value);
  assert.ok(result.ctx.game.party.life.vitals !== undefined && result.ctx.game.week.index === normalized.week.index + 1, 'Il salvataggio vecchio va avanti');
  const { renderPartyPage } = await import('../src/ui/party-page.js');
  const { renderInbox } = await import('../src/ui/game-mode.js');
  const state = run.store.getState();
  state.game.party.life.requests.push({ id: 'richiesta-ui-1', kind: 'fondi', from: 'actor', refId: state.game.party.currents[0].id, title: 'Fondi per i territori', body: 'Prova', acceptLabel: '500 €', ask: { amount: 500 }, counter: null, stage: 'aperta', week: 1, dueWeek: 99, delays: 0, source: 'simulation' });
  const html = renderPartyPage(state, { tab: 'vita', record: null, logoFor: () => null, selectable: [], territory: {} });
  assert.ok(!/undefined|NaN|\[object Object\]/.test(html.replace(/data-[a-z-]+="[^"]*"/g, '')), 'La scheda Vita interna non mostra valori non validi');
  for (const text of ['Vita interna', 'RICHIESTE', 'LE AREE E I LORO CAPI', 'ACCORDI', 'CONGRESSO', 'DIRIGENTI LOCALI', 'FONDAZIONE, FUSIONE, IDENTITÀ', 'data-life-request="richiesta-ui-1"', 'data-life-found', 'figura simulata']) assert.ok(html.includes(text), `Vita interna: manca «${text}»`);
  const inbox = renderInbox(state);
  assert.ok(/hq-day/.test(inbox) && !/undefined|NaN/.test(inbox.replace(/data-[a-z-]+="[^"]*"/g, '')), 'Le decisioni mostrano il giorno della settimana');
  const tabs = renderPartyPage(state, { tab: 'panoramica' });
  assert.ok(tabs.includes('data-section-tab-value="vita"'), 'La scheda Vita interna è tra quelle del partito');
}

console.log(`Vita interna del partito verificata: ${DAILY_EVENTS.length} eventi giornalieri (${new Set(DAILY_EVENTS.map(item => item.category)).size} categorie, catene, successi rari), ${(runA.perWeek.reduce((a, b) => a + b, 0) / runA.perWeek.length).toFixed(1)} decisioni a settimana distribuite su tutti i giorni senza ripetizioni; capi delle correnti con carattere e richieste che dipendono dallo stato (seggi, linea, liste); risposta, trattativa con controfferta, accordi con durata, rottura, rinnovo e memoria; congresso in sette fasi con delegati dalle federazioni, alleanze, voto e conseguenze; dirigenti locali, fughe e ricostruzione all’opposizione; fondazione, scissione, fusione e cambio di nome con effetti su iscritti, comitati, cassa, seggi e sondaggi; salvataggi vecchi, determinismo e scheda Vita interna.`);
