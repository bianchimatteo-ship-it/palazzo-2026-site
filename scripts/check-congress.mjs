// The congress, from the first phase to the vote: the work the player can do on the way (mobilise the cadres, tour the federations, campaign in a region, write the motion, negotiate with an area,
// weave alliances), phase by phase, and how the vote ends.
//   - the table of the actions (phases, costs, what each needs, the risk it declares) is coherent with the phases of the congress;
//   - what can be done in each phase and why not when it cannot (no area backed, wrong phase, once only, nothing to point at);
//   - the costs are exactly what is paid (days, own funds, the party's treasury, capital), a shortfall says what is missing and changes nothing, a refused action leaves the game as it was;
//   - what an action does is written in the congress (it is saved with the game and read again): mobilisation, tours, campaigns in a region, the motion, alliances; they move the delegates and the
//     projection of the vote; the risk is real: both branches are reached and each has its consequence;
//   - the vote: the candidate, the incumbent, the supporter, the unity ticket, a close result opens a conflict, the leadership, the bodies and the strengths follow, the congress closes and is remembered,
//     the same congress gives the same result, a congress nobody answers is decided by itself after six weeks, and across many seeds the player's work makes a difference without deciding everything.
import assert from 'node:assert/strict';
import { createGameState, costProblem, lifeCongress } from '../src/core/career-engine.js';
import { advanceLife, congressActionsOf, congressWork, lifeDelegates, normalizeLife, projectCongress, resolveCongress, congressPhaseOf } from '../src/core/party-life-engine.js';
import { CONGRESS_ACTIONS, CONGRESS_PHASES } from '../src/data/simulation/party-life-rules.js';
import { checkInvariants } from '../src/core/invariants.js';

const addDays = (date, days) => { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10); };
const START = '2027-01-04';
const STATS = { popularity: 45, reputation: 55, notoriety: 45, influence: 45, experience: 40 };
const signals = { crime: 50, perceived: 50, spread: 150, euStatus: 'regolare', stability: 60, ministers: 0, majorityMood: 55, regions: [], partyGoverning: false, neighbours: [], summer: false, autumn: false, winter: true };
const newGame = (seed, { founder = false } = {}) => createGameState({ seedText: seed, currentDate: START, level: 'comunale', party: { id: 'partito-prova', label: 'Partito di prova', founder }, place: { region: 'Toscana', municipality: 'Siena' }, stats: STATS });
function withTerritory(game) {
  const org = game.party.org;
  org.committees = org.sections.map((section, index) => ({
    id: `comitato-regione-${section.region}`, level: 'regione', name: section.region, region: section.region, parentId: null, status: 'consolidamento', statusSince: 1, foundedWeek: 1,
    members: section.members, activists: Math.round(section.members * 0.08), organization: section.vitality, consensus: 50, loyalty: 55,
    leader: { label: 'Coordinamento regionale (figura simulata)', currentId: game.party.currents[index % game.party.currents.length].id, player: false }
  }));
  return game;
}
const A = { date: START, remember: (g, entry) => { g.memory ??= []; g.memory.unshift({ id: `m-${g.memory.length}`, week: g.week.index, weight: 1, tone: 'neutral', source: 'simulation', ...entry }); }, memoryAbout: () => 0, changeRelation: (g, id, delta) => { const item = g.party.currents.find(entry => entry.id === id); if (item) item.value = item.relation = Math.max(0, Math.min(100, (item.value ?? 50) + delta)); }, book: (g, org, amount) => { org.treasury.balance += amount; }, createParty: () => { throw new Error('non usato'); } };
const rander = seed => { let a = [...seed].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 7) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// A game that has reached a phase of the congress (the congress opened, the player backs the second-strongest area, money and capital in hand).
function atPhase(seed, phaseId, { aligned = true, funds = 5000, treasury = 5000, capital = 20 } = {}) {
  const game = withTerritory(newGame(seed));
  const party = game.party;
  party.org.congress.nextWeek = 25;
  let week = 0;
  const target = CONGRESS_PHASES.findIndex(item => item.id === phaseId);
  for (week = 1; week <= 26; week++) {
    advanceLife(game, A, { week, date: addDays(START, week * 7), rand: rander(`${seed}|c${week}`), env: { signals } });
    game.week.index = week;
    const congress = party.life.congress;
    if (congress && CONGRESS_PHASES.findIndex(item => item.id === congressPhaseOf(congress, week)) >= target) break;
  }
  const sorted = [...party.currents].sort((a, b) => b.strength - a.strength);
  party.alignedCurrentId = aligned ? sorted[1].id : null;
  // (the areas make alliances by themselves on the way: the player's own area starts without one, so that the player's work can be told apart)
  if (party.life.congress) party.life.congress.alliances = party.life.congress.alliances.filter(al => !al.ids.includes(party.alignedCurrentId));
  game.resources.funds = funds; game.resources.politicalCapital = capital; party.org.treasury.balance = treasury; game.week.ap = 6; game.status = 'active';
  return game;
}
const run = (game, kind, target = null) => lifeCongress({ game, stats: { ...STATS }, parliament: null }, { currentDate: START }, kind, target);
const snapshot = game => JSON.stringify({ ap: game.week.ap, funds: game.resources.funds, capital: game.resources.politicalCapital, treasury: game.party.org.treasury.balance, congress: game.party.life.congress, currents: game.party.currents.map(item => [item.id, item.strength, item.value]) });

// ---------- 1. the table of the actions ----------
{
  const phaseIds = new Set(CONGRESS_PHASES.map(item => item.id));
  const ids = Object.keys(CONGRESS_ACTIONS);
  assert.deepEqual(ids, ['mobilita', 'federazioni', 'delegati', 'mozione', 'trattativa', 'alleanza'], 'Le sei azioni del congresso.');
  for (const [id, spec] of Object.entries(CONGRESS_ACTIONS)) {
    assert.ok(spec.label && spec.detail.length > 40, `${id}: nome e spiegazione.`);
    assert.ok(spec.phases.length >= 1 && spec.phases.every(phase => phaseIds.has(phase) && phase !== 'voto'), `${id}: fasi valide, mai il voto stesso.`);
    assert.ok(Object.keys(spec.cost).length >= 1 && Object.entries(spec.cost).every(([key, value]) => ['ap', 'funds', 'treasury', 'capital'].includes(key) && value > 0), `${id}: un costo vero (${JSON.stringify(spec.cost)}).`);
    if (spec.risk) assert.ok(spec.risk.text.length > 30 && (spec.risk.chance === null || (spec.risk.chance > 0 && spec.risk.chance < 1)), `${id}: il rischio è dichiarato.`);
    assert.ok([null, 'regione', 'area'].includes(spec.needs), `${id}: cosa richiede.`);
  }
  assert.ok(CONGRESS_ACTIONS.federazioni.cost.treasury > 0 && CONGRESS_ACTIONS.delegati.cost.funds > 0, 'Alcune cose le paga il partito, altre il giocatore di tasca sua: due cassse diverse.');
  assert.ok(ids.filter(id => CONGRESS_ACTIONS[id].risk).length >= 3 && ids.filter(id => CONGRESS_ACTIONS[id].once).length === 2, 'Tre azioni rischiose e due che si fanno una volta.');
}

// ---------- 2. what can be done in each phase ----------
{
  const seen = new Map();
  for (const phase of CONGRESS_PHASES.filter(item => item.id !== 'voto')) {
    const game = atPhase('fasi', phase.id);
    game.party.life.congress.alliances = [];   // (the areas make their own alliances on the way: here only the phase counts)
    const phaseNow = congressPhaseOf(game.party.life.congress, game.week.index);
    const actions = congressActionsOf(game);
    assert.equal(actions.length, 6, `${phase.id}: sei azioni elencate.`);
    for (const action of actions) {
      const expected = CONGRESS_ACTIONS[action.id].phases.includes(phaseNow);
      const blockedByOther = !expected || (action.id === 'alleanza' && game.party.life.congress.alliances.some(al => al.ids.includes(game.party.alignedCurrentId))) || (action.id === 'trattativa' && game.party.currents.filter(item => item.id !== game.party.alignedCurrentId).every(item => game.party.life.congress.alliances.some(al => al.ids.includes(game.party.alignedCurrentId) && al.ids.includes(item.id))));
      assert.equal(action.available, !blockedByOther, `${phase.id} (ora ${phaseNow}): ${action.id} ${action.available ? 'disponibile' : `non disponibile: ${action.reason}`}.`);
      if (!action.available) assert.ok(action.reason && action.reason.length > 10, `${phase.id}: ${action.id} dice perché no.`);
      seen.set(action.id, (seen.get(action.id) ?? 0) + (action.available ? 1 : 0));
    }
  }
  for (const id of Object.keys(CONGRESS_ACTIONS)) assert.ok(seen.get(id) >= 1, `${id} è disponibile in almeno una fase.`);
  assert.ok(seen.get('mobilita') >= 4 && seen.get('delegati') === 1, 'La campagna sui delegati si fa solo nella fase dei delegati; mobilitare quasi sempre.');
  // without an area to back, nothing can be done and it says so
  const alone = atPhase('senza-area', 'preparazione', { aligned: false });
  assert.ok(congressActionsOf(alone).every(action => !action.available && /area di riferimento/.test(action.reason)), 'Senza un’area di riferimento nessuna azione, con la ragione.');
  assert.throws(() => run(alone, 'mobilita'), /area di riferimento/, 'Nemmeno la richiesta diretta passa.');
  // a game without a congress: nothing
  const none = withTerritory(newGame('nessun-congresso'));
  none.party.alignedCurrentId = none.party.currents[0].id;
  assert.deepEqual(congressActionsOf(none), [], 'Senza congresso non c’è nulla da fare.');
  assert.throws(() => run(none, 'mobilita'), /Nessun congresso/);
}

// ---------- 3. the costs, the shortfalls, the refusals ----------
{
  const pay = (kind, phase, target = null) => {
    const game = atPhase(`costi-${kind}`, phase);
    const before = { ap: game.week.ap, funds: game.resources.funds, capital: game.resources.politicalCapital, treasury: game.party.org.treasury.balance };
    const { ctx, lines } = run(game, kind, target);
    const spec = CONGRESS_ACTIONS[kind].cost;
    assert.equal(before.ap - ctx.game.week.ap, spec.ap ?? 0, `${kind}: giorni pagati.`);
    assert.equal(before.capital - ctx.game.resources.politicalCapital, spec.capital ?? 0, `${kind}: capitale pagato.`);
    assert.equal(before.funds - ctx.game.resources.funds, spec.funds ?? 0, `${kind}: fondi propri pagati.`);
    assert.equal(before.treasury - ctx.game.party.org.treasury.balance, spec.treasury ?? 0, `${kind}: tesoreria del partito pagata.`);
    assert.ok(lines.length >= 1 && ctx.game.log.some(entry => entry.title === CONGRESS_ACTIONS[kind].label), `${kind}: resta nel diario.`);
    const invariants = checkInvariants({ clock: { currentDate: START }, game: ctx.game });
    assert.ok(invariants.ok, `${kind}: le invarianti reggono (${invariants.issues.slice(0, 2).map(item => item.message).join('; ')}).`);
    return ctx.game;
  };
  pay('mobilita', 'preparazione');
  pay('federazioni', 'preparazione');
  pay('mozione', 'preparazione');
  const forRegion = atPhase('regione', 'delegati');
  pay('delegati', 'delegati', forRegion.party.org.sections[0].region);
  const forArea = atPhase('area', 'alleanze');
  pay('trattativa', 'alleanze', forArea.party.currents.find(item => item.id !== forArea.party.alignedCurrentId).id);
  pay('alleanza', 'trattative');
  // shortfalls: each says what is missing and changes nothing
  const lacks = [['federazioni', 'preparazione', { treasury: 100 }, /tesoreria del partito/], ['delegati', 'delegati', { funds: 100 }, /fondi/], ['mozione', 'preparazione', { capital: 0 }, /capitale/], ['mobilita', 'preparazione', { ap: 0 }, /giorni/]];
  for (const [kind, phase, shortage, message] of lacks) {
    const game = atPhase(`manca-${kind}`, phase);
    if ('ap' in shortage) game.week.ap = shortage.ap;
    if ('capital' in shortage) game.resources.politicalCapital = shortage.capital;
    if ('funds' in shortage) game.resources.funds = shortage.funds;
    if ('treasury' in shortage) game.party.org.treasury.balance = shortage.treasury;
    const before = snapshot(game);
    const target = kind === 'delegati' ? game.party.org.sections[0].region : null;
    assert.throws(() => run(game, kind, target), message, `${kind}: dice cosa manca.`);
    assert.equal(snapshot(game), before, `${kind}: nulla cambia se manca qualcosa.`);
  }
  // wrong phase, once only, wrong target
  const early = atPhase('presto', 'forza');
  assert.throws(() => run(early, 'trattativa', early.party.currents.find(item => item.id !== early.party.alignedCurrentId).id), /solo in|prima del voto|ora siamo/, 'Fuori fase non si può.');
  const once = atPhase('una-volta', 'preparazione');
  const afterTour = run(once, 'federazioni').ctx.game;
  assert.throws(() => run(afterTour, 'federazioni'), /già fatto/, 'Il giro delle federazioni si fa una volta.');
  const afterMotion = run(once, 'mozione').ctx.game;
  assert.throws(() => run(afterMotion, 'mozione'), /già depositato/, 'La mozione si deposita una volta.');
  const region = atPhase('bersaglio', 'delegati');
  assert.throws(() => run(region, 'delegati', 'Atlantide'), /federazione/, 'Una regione senza federazione non vale.');
  assert.throws(() => run(region, 'delegati', null), /federazione/);
  const area = atPhase('bersaglio-area', 'alleanze');
  assert.throws(() => run(area, 'trattativa', area.party.alignedCurrentId), /area con cui trattare/, 'Non si tratta con se stessi.');
  assert.throws(() => run(area, 'trattativa', 'area-inesistente'), /area con cui trattare/);
}

// ---------- 4. what is written in the congress: it moves the delegates and the vote, it is saved and read again ----------
{
  const share = (game, id) => lifeDelegates(game.party, game.party.life, game.party.life.congress).byCurrent[id];
  const game = atPhase('persistenza', 'delegati');
  const id = game.party.alignedCurrentId;
  const base = share(game, id);
  const baseline = projectCongress(game, { mode: 'support', backedId: id }).ranked.find(row => row.members?.includes(id))?.pct ?? 0;
  let work = game;
  work = run(work, 'mobilita').ctx.game; const afterMobilise = share(work, id);
  work.party.life.congress.tours = []; work.party.life.congress.pushes = [];
  const congress = work.party.life.congress;
  // the marks, one by one (the draws are fixed: `rand` low means the risk strikes, high that it does not)
  congressWork(work, A, { kind: 'federazioni', week: 10, rand: () => 0.9 });
  const afterTour = lifeDelegates(work.party, work.party.life, congress).byCurrent[id];
  congressWork(work, A, { kind: 'delegati', week: 10, rand: () => 0.9, target: work.party.org.sections[0].region });
  const afterPush = lifeDelegates(work.party, work.party.life, congress).byCurrent[id];
  congressWork(work, A, { kind: 'mozione', week: 10, rand: () => 0.9 });
  assert.ok(afterMobilise >= base && afterTour >= afterMobilise && afterPush >= afterTour, `I delegati dell’area non calano mai con il lavoro (${base} → ${afterMobilise} → ${afterTour} → ${afterPush}).`);
  assert.ok(afterPush > base, `E in tutto crescono (${base} → ${afterPush}).`);
  assert.equal(congress.tours.length, 1); assert.equal(congress.pushes.length, 1); assert.ok(congress.playerMotion && congress.playerMotion.quality >= 0.4 && !congress.playerMotion.weak, 'Segni nel congresso: giro, campagna, mozione.');
  const projected = projectCongress(work, { mode: 'support', backedId: id }).ranked.find(row => row.members?.includes(id))?.pct ?? 0;
  assert.ok(projected > baseline, `Nella proiezione del voto l’area guadagna (${baseline} → ${projected}).`);
  // saved and read again: the same congress, the same projection
  const reloaded = JSON.parse(JSON.stringify(work));
  assert.equal(JSON.stringify(reloaded.party.life.congress), JSON.stringify(work.party.life.congress), 'Il congresso salvato e riletto è lo stesso, con i segni del giocatore.');
  assert.equal(JSON.stringify(projectCongress(reloaded, { mode: 'support', backedId: id })), JSON.stringify(projectCongress(work, { mode: 'support', backedId: id })), 'E la stessa proiezione.');
  const normalized = normalizeLife(reloaded.party, { seed: reloaded.seed ?? 1, week: 11 });
  assert.equal(normalized.congress.tours.length, 1, 'Normalizzare un salvataggio non perde i segni.');
  // an old save, from before these actions, still works: no tours, no pushes, no motion
  const old = JSON.parse(JSON.stringify(work));
  delete old.party.life.congress.tours; delete old.party.life.congress.pushes; delete old.party.life.congress.playerMotion;
  assert.doesNotThrow(() => lifeDelegates(old.party, old.party.life, old.party.life.congress), 'Un congresso salvato prima di queste azioni si legge ancora.');
  assert.doesNotThrow(() => projectCongress(old, { mode: 'incumbent' }));
  assert.ok(congressActionsOf(old).length === 6, 'E le azioni si elencano.');
  // the alliance of the trattativa is a joint motion: the delegates add up under the strongest
  const ally = atPhase('trattativa', 'alleanze');
  const aligned = ally.party.alignedCurrentId, partner = ally.party.currents.find(item => item.id !== aligned);
  ally.party.life.congress.alliances = [];
  partner.value = partner.relation = 95; ally.party.life.actors[partner.id].loyalty = 90; ally.party.life.actors[partner.id].grievance = 0;
  const lines = congressWork(ally, A, { kind: 'trattativa', week: 12, rand: () => 0.05, target: partner.id });
  assert.ok(/Trattativa riuscita/.test(lines[0]) && ally.party.life.congress.alliances.some(al => al.ids.includes(aligned) && al.ids.includes(partner.id) && al.origin === 'trattativa'), 'Una trattativa riuscita crea un’alleanza di mozioni.');
  const joint = projectCongress(ally, { mode: 'support', backedId: aligned }).ranked.find(row => row.members?.includes(aligned) && row.members.includes(partner.id));
  assert.ok(joint && joint.pct > 0, 'La proiezione mostra la mozione comune.');
  assert.equal(congressActionsOf(ally).find(item => item.id === 'alleanza').available, false, 'Con un’alleanza già fatta non serve più tesserne una.');
}

// ---------- 5. the risks are real: both branches are reached and each has its consequence ----------
{
  // giro delle federazioni
  const calm = atPhase('rischio-giro', 'preparazione'); const noisy = structuredClone(calm);
  const rival = calm.party.currents.find(item => item.id === calm.party.leaderCurrentId && item.id !== calm.party.alignedCurrentId) ?? calm.party.currents.find(item => item.id !== calm.party.alignedCurrentId);
  const relationBefore = rival.value ?? 50;
  congressWork(calm, A, { kind: 'federazioni', week: 8, rand: () => 0.99 });
  congressWork(noisy, A, { kind: 'federazioni', week: 8, rand: () => 0.01 });
  assert.equal(calm.party.life.congress.tours[0].bonus, 0.07, 'Senza intoppi il giro vale il 7%.');
  assert.equal(noisy.party.life.congress.tours[0].bonus, 0.035, 'Con l’intoppo il vantaggio si dimezza.');
  assert.ok(noisy.party.currents.find(item => item.id === rival.id).value < relationBefore && calm.party.currents.find(item => item.id === rival.id).value === relationBefore, 'E l’area dominante si raffredda; senza intoppi no.');
  // campagna sui delegati: the backlash only where another area leads the regional committee
  const hostile = atPhase('rischio-regione', 'delegati'); const friendly = structuredClone(hostile);
  const region = hostile.party.org.sections.find(section => hostile.party.org.committees.find(item => item.level === 'regione' && item.region === section.region)?.leader.currentId !== hostile.party.alignedCurrentId).region;
  const own = friendly.party.org.committees.find(item => item.level === 'regione' && item.region === region);
  own.leader = { ...own.leader, currentId: friendly.party.alignedCurrentId };
  congressWork(hostile, A, { kind: 'delegati', week: 8, rand: () => 0.01, target: region });
  congressWork(friendly, A, { kind: 'delegati', week: 8, rand: () => 0.01, target: region });
  assert.equal(hostile.party.life.congress.pushes[0].bonus, 0.125, 'In una federazione guidata da un’altra area il rischio scatta: il vantaggio si dimezza.');
  assert.equal(friendly.party.life.congress.pushes[0].bonus, 0.25, 'Dove la guida la tua area, il rischio non c’è.');
  congressWork(hostile, A, { kind: 'delegati', week: 9, rand: () => 0.99, target: region });
  assert.equal(hostile.party.life.congress.pushes[1].bonus, 0.25, 'E senza il colpo di sfortuna vale per intero.');
  // mozione: solid or weak
  const solid = atPhase('rischio-mozione', 'mozioni'); const weak = structuredClone(solid);
  const grievanceBefore = Object.fromEntries(weak.party.currents.map(item => [item.id, weak.party.life.actors[item.id].grievance]));
  congressWork(solid, A, { kind: 'mozione', week: 20, rand: () => 0.99 });
  congressWork(weak, A, { kind: 'mozione', week: 20, rand: () => 0.01 });
  assert.ok(!solid.party.life.congress.playerMotion.weak && solid.party.life.congress.playerMotion.quality >= 0.55, 'Una mozione solida pesa.');
  assert.ok(weak.party.life.congress.playerMotion.weak && weak.party.life.congress.playerMotion.quality < 0.4, 'Una mozione debole non pesa.');
  assert.ok(weak.party.currents.filter(item => item.id !== weak.party.alignedCurrentId).every(item => weak.party.life.actors[item.id].grievance >= grievanceBefore[item.id] + 2), 'E irrigidisce le altre aree (malcontento).');
  const strong = projectCongress(solid, { mode: 'support', backedId: solid.party.alignedCurrentId }).ranked.find(row => row.members?.includes(solid.party.alignedCurrentId)).delegates;
  const feeble = projectCongress(weak, { mode: 'support', backedId: weak.party.alignedCurrentId }).ranked.find(row => row.members?.includes(weak.party.alignedCurrentId)).delegates;
  assert.ok(strong > feeble, `Solida contro debole: ${strong} contro ${feeble} delegati.`);
  // trattativa: acceptance depends on the area
  const friendlyTalk = atPhase('rischio-trattativa', 'trattative'); const hardTalk = structuredClone(friendlyTalk);
  const partnerId = friendlyTalk.party.currents.find(item => item.id !== friendlyTalk.party.alignedCurrentId).id;
  for (const [game, relation, loyalty, grievance] of [[friendlyTalk, 95, 90, 0], [hardTalk, 5, 10, 95]]) { const current = game.party.currents.find(item => item.id === partnerId); current.value = current.relation = relation; game.party.life.actors[partnerId].loyalty = loyalty; game.party.life.actors[partnerId].grievance = grievance; game.party.life.congress.alliances = []; }
  const chanceOf = game => { const actor = game.party.life.actors[partnerId]; const current = game.party.currents.find(item => item.id === partnerId); return Math.max(0.1, Math.min(0.85, 0.3 + (current.value ?? 50) / 160 + actor.loyalty / 400 - actor.grievance / 300)); };
  assert.ok(chanceOf(friendlyTalk) > 0.8 && chanceOf(hardTalk) <= 0.12, `La probabilità dipende dall’area (${chanceOf(friendlyTalk).toFixed(2)} contro ${chanceOf(hardTalk).toFixed(2)}).`);
  const hardRelation = hardTalk.party.currents.find(item => item.id === partnerId).value;
  const refused = congressWork(hardTalk, A, { kind: 'trattativa', week: 12, rand: () => 0.99, target: partnerId });
  assert.ok(/rifiuta/.test(refused[0]) && hardTalk.party.currents.find(item => item.id === partnerId).value === hardRelation - 3 && hardTalk.party.life.congress.alliances.length === 0, 'Se rifiuta: il rapporto scende di 3 e nessuna alleanza.');
  assert.ok(hardTalk.party.life.actors[partnerId].grievance > 95, 'E il malcontento sale.');
  // the odds, measured: over many draws the risk of the tour is the declared one
  let hits = 0; const draw = rander('giro-statistica'); const N = 4000;
  for (let i = 0; i < N; i++) { const game = structuredClone(calm); game.party.life.congress.tours = []; congressWork(game, A, { kind: 'federazioni', week: 8, rand: draw }); if (game.party.life.congress.tours[0].noisy) hits++; }
  assert.ok(Math.abs(hits / N - CONGRESS_ACTIONS.federazioni.risk.chance) < 0.03, `Il rischio del giro esce come dichiarato (${(hits / N).toFixed(3)} contro ${CONGRESS_ACTIONS.federazioni.risk.chance}).`);
}

// ---------- 6. the vote and how it ends ----------
{
  const modes = new Map();
  const margins = [];
  let close = 0, won = 0, lost = 0, workedBetter = 0, seeds = 0, sameAsBefore = 0;
  for (let index = 0; index < 24; index++) {
    const seed = `esito-${index}`;
    const game = atPhase(seed, 'mozioni');
    const aligned = game.party.alignedCurrentId;
    const twin = structuredClone(game);
    // the work: all that the phase allows, with the draws left to the seed
    const draws = rander(`${seed}|lavoro`);
    for (const [kind, target] of [['mobilita', null], ['mozione', null], ['trattativa', game.party.currents.find(item => item.id !== aligned).id], ['alleanza', null]]) if (congressActionsOf(game).find(item => item.id === kind)?.available) congressWork(game, A, { kind, week: 24, rand: draws, target });
    const pct = g => projectCongress(g, { mode: 'support', backedId: aligned }).ranked.find(row => row.members?.includes(aligned))?.pct ?? 0;
    seeds++; if (pct(game) > pct(twin)) workedBetter++; if (pct(game) >= pct(twin) - 0.0001) sameAsBefore++;
    const mode = ['support', 'candidate', 'incumbent'][index % 3];
    const before = structuredClone(game);
    const result = resolveCongress(game, A, { mode, backedId: aligned, unity: index % 4 === 3, influence: 30 + (index % 5) * 12, week: 26, date: START, rand: rander(`${seed}|voto`) });
    const { outcome } = result;
    modes.set(mode, (modes.get(mode) ?? 0) + 1);
    assert.equal(game.party.leaderCurrentId, outcome.winnerCurrentId, `${seed}: il vincitore guida il partito.`);
    assert.ok(game.party.life.congress === null && game.party.life.lastCongress.winnerId === outcome.winnerCurrentId && game.party.life.lastCongress.week === 26, `${seed}: il congresso si chiude e resta in memoria.`);
    assert.equal(Object.values(game.party.life.organs.seats).reduce((a, b) => a + b, 0), game.party.life.organs.total, `${seed}: gli organi si riassegnano.`);
    assert.ok(Math.abs(outcome.ranked.reduce((sum, row) => sum + row.pct, 0) - 100) < 0.6, `${seed}: le percentuali sommano a 100.`);
    assert.ok(outcome.ranked.every((row, i, rows) => i === 0 || rows[i - 1].pct >= row.pct), `${seed}: ordinati.`);
    assert.ok(outcome.margin === Math.round((outcome.ranked[0].pct - (outcome.ranked[1]?.pct ?? 0)) * 10) / 10, `${seed}: lo scarto è quello tra i primi due.`);
    if (mode === 'support') assert.ok(!outcome.ranked.some(row => row.id === 'player'), `${seed}: chi sostiene non è in lista.`); else assert.ok(outcome.ranked.some(row => row.id === 'player'), `${seed}: il candidato e il segretario uscente sono in lista.`);
    assert.equal(typeof outcome.playerWon, 'boolean');
    // the official result is told once, at the centre of the page: the winning line, the share of the delegates, the margin, and whether the player's line won
    const popup = game.celebrations?.outcome;
    assert.ok(popup && popup.kind === 'congresso' && popup.id === 'esito-congresso-26', `${seed}: l'esito del congresso è annunciato.`);
    assert.equal(popup.tone, outcome.playerWon ? 'win' : 'loss', `${seed}: vittoria o sconfitta della linea del giocatore dichiarata.`);
    assert.ok(popup.lines.join(' ').includes(`${outcome.winner.pct}%`) && popup.lines.join(' ').includes(String(outcome.margin)) && popup.lines.join(' ').includes(outcome.winner.label), `${seed}: percentuale dei delegati, margine e linea vincente.`);
    assert.ok(outcome.playerWon ? /vince il congresso/.test(popup.headline) : /perde/.test(popup.headline), `${seed}: il titolo dice se la linea ha vinto o perso.`);
    if (outcome.playerWon) won++; else lost++;
    margins.push(outcome.margin);
    if (outcome.margin < 8) { close++; assert.ok(game.party.org.conflicts.some(item => /fotofinish/.test(item.title)), `${seed}: un risultato al fotofinish apre un conflitto.`); }
    assert.ok(game.party.life.history.some(item => item.kind === 'congresso') && (game.memory ?? []).some(item => item.kind === 'congresso'), `${seed}: il congresso resta nella cronologia e nella memoria.`);
    const strengths = game.party.currents.reduce((sum, item) => sum + item.strength, 0), strengthsBefore = before.party.currents.reduce((sum, item) => sum + item.strength, 0);
    assert.ok(Math.abs(strengths - strengthsBefore) <= 8, `${seed}: le forze si ridistribuiscono senza inventare peso (${strengthsBefore} → ${strengths}).`);
    assert.ok(game.party.org.treasury.balance < before.party.org.treasury.balance, `${seed}: il congresso costa alla tesoreria.`);
    // the same congress, the same result
    const again = resolveCongress(structuredClone(before), A, { mode, backedId: aligned, unity: index % 4 === 3, influence: 30 + (index % 5) * 12, week: 26, date: START, rand: rander(`${seed}|voto`) }).outcome;
    assert.equal(again.ranked.map(row => `${row.id}:${row.pct}`).join(), outcome.ranked.map(row => `${row.id}:${row.pct}`).join(), `${seed}: lo stesso congresso dà lo stesso risultato.`);
  }
  assert.ok(modes.get('support') >= 6 && modes.get('candidate') >= 6 && modes.get('incumbent') >= 6, 'Tutti e tre i modi di arrivare al voto sono provati.');
  assert.ok(won >= 3 && lost >= 3, `Il giocatore vince e perde: ${won} vittorie, ${lost} sconfitte su ${won + lost}.`);
  assert.ok(Math.min(...margins) < 20 && Math.max(...margins) > 8, `Scarti diversi (da ${Math.min(...margins)} a ${Math.max(...margins)}).`);
  assert.ok(workedBetter >= seeds * 0.7 && sameAsBefore === seeds, `Il lavoro del giocatore migliora la proiezione dell’area nella maggior parte dei casi e non la peggiora mai (${workedBetter}/${seeds} migliori, ${sameAsBefore}/${seeds} non peggiori).`);
  // the unity ticket: it takes votes from the strongest rival
  const plain = atPhase('unita', 'mozioni'); const unity = structuredClone(plain);
  const a = resolveCongress(plain, A, { mode: 'candidate', backedId: plain.party.alignedCurrentId, unity: false, influence: 50, week: 26, date: START, rand: rander('unita|voto') }).outcome;
  const b = resolveCongress(unity, A, { mode: 'candidate', backedId: unity.party.alignedCurrentId, unity: true, influence: 50, week: 26, date: START, rand: rander('unita|voto') }).outcome;
  const player = outcome => outcome.ranked.find(row => row.id === 'player' || row.members?.includes('player')).pct;
  assert.ok(player(b) >= player(a), `La lista unitaria non toglie voti al candidato (${player(a)} → ${player(b)}).`);
  // a congress nobody answered within six weeks is decided without the player
  const late = atPhase('in-ritardo', 'voto');
  const open = late.party.life.congress;
  assert.ok(open, 'Il congresso è ancora aperto al voto.');
  late.party.org.congress.nextWeek = open.voteWeek;
  for (let week = open.voteWeek + 1; week <= open.voteWeek + 8 && late.party.life.congress; week++) { late.week.index = week; advanceLife(late, A, { week, date: addDays(START, week * 7), rand: rander(`late${week}`), env: { signals } }); }
  assert.ok(late.party.life.congress === null && Boolean(late.party.life.lastCongress), 'Se nessuno risponde, dopo sei settimane il congresso si decide da solo.');
  console.log(`Congresso verificato: ${Object.keys(CONGRESS_ACTIONS).length} azioni (fasi, costi in giorni, fondi propri, tesoreria e capitale, requisiti, rischio dichiarato e misurato su 4.000 prove), elenco per fase con la ragione di ogni “no”, richieste respinte senza toccare nulla, segni scritti nel congresso (mobilitazione, giro, campagna per regione, mozione, alleanze) che spostano delegati e proiezione e sopravvivono al salvataggio anche da un vecchio salvataggio; ${seeds} congressi chiusi con tre modi di arrivare al voto (${won} vittorie e ${lost} sconfitte del giocatore, ${close} al fotofinish con conflitto), guida, organi, forze e cronologia che seguono, stesso congresso stesso risultato, lista unitaria, congresso senza risposta deciso dopo sei settimane.`);
}
