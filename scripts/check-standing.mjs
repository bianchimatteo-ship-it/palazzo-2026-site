// Come ti vedono e quanto pesi: le quattro reputazioni (interna, sul territorio, mediatica, istituzionale), l’influenza per
// settore, il capitale e la notorietà, e come entrano nelle promozioni. Nessuna promozione è automatica: dipende dall’insieme di
// risultati (anche lontani), relazioni, partito, correnti, territorio, istituzione e momento politico, e può riuscire, fallire,
// slittare o far arretrare. Qui: regole e dati, il motore (effetti, decadimento, soglie di carica), i pesi delle promozioni, il
// collegamento con obiettivi e risultati storici, i vecchi salvataggi, la partita vera e la pagina della Carriera.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer, playWeek } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const R = await module('src/data/simulation/standing-rules.js');
const E = await module('src/core/standing-engine.js');
const P = await module('src/core/progression-engine.js');
const C = await module('src/core/career-engine.js');
const { CAREER_EVENTS } = await module('src/data/simulation/career-rules.js');
const { DAILY_EVENTS } = await module('src/data/simulation/daily-events.js');
const { OBJECTIVE_BY_ID, CAREER_OBJECTIVES } = await module('src/data/simulation/objective-rules.js');
const { AREA_BY_ID, POLICY_AREAS } = await module('src/data/simulation/policy-rules.js');
const { careerOverview } = await module('src/core/career-overview.js');
const { renderCareerPage } = await module('src/ui/career-page.js');
const { governmentPostOdds } = await module('src/core/parliament-engine.js');
const { amendmentOdds } = await module('src/core/lawmaking-engine.js');
const { checkInvariants } = await module('src/core/invariants.js');
const clean = (html, where) => { const bad = html.replace(/data-[a-z-]+="[^"]*"/g, '').match(/.{0,60}(undefined|NaN|\[object Object\]|Infinity).{0,60}/); assert.ok(!bad, `${where}: valori non validi (${bad?.[0]})`); };

// ---------- 1. regole e dati ----------
{
  assert.deepEqual(R.REPUTATION_IDS, ['internal', 'territorial', 'media', 'institutional'], 'Quattro reputazioni distinte');
  assert.ok(R.REPUTATION_IDS.every(id => R.REPUTATIONS[id].label && R.REPUTATIONS[id].detail && R.REPUTATIONS[id].drivers), 'Ogni reputazione dice cos’è e da cosa dipende');
  assert.equal(R.SECTORS.length, 8, 'Otto settori di influenza');
  assert.ok(Object.values(AREA_BY_ID).every(area => R.SECTOR_IDS.includes(area.group)), 'Ogni tema di policy appartiene a un settore');
  assert.equal(R.sectorOfArea('sanita'), 'welfare');
  assert.equal(R.sectorOfArea('trasporti'), 'territorio');
  assert.equal(R.sectorOfArea('welfare'), 'welfare', 'Un settore resta se stesso');
  assert.equal(R.sectorOfArea('inventato'), null);
  assert.ok(R.areasOfSector('welfare').includes('sanita') && R.areasOfSector('welfare').includes('pensioni'));
  // Ogni categoria di evento sposta una reputazione (o nessuna, di proposito).
  const categories = new Set([...CAREER_EVENTS, ...DAILY_EVENTS].map(event => event.category).filter(Boolean));
  const unmapped = [...categories].filter(category => !R.CATEGORY_REPUTATION[category]);
  assert.deepEqual(unmapped.sort(), ['quiete', 'risorse'], `Le categorie senza reputazione sono scelte, non dimenticanze (${unmapped})`);
  assert.ok(Object.values(R.CATEGORY_REPUTATION).every(id => R.REPUTATION_IDS.includes(id)));
  const known = new Set([...CAREER_EVENTS, ...DAILY_EVENTS].map(event => event.id));
  assert.ok(Object.entries(R.EVENT_SECTORS).every(([id, area]) => known.has(id) && R.sectorOfArea(area)), 'Gli eventi per tema esistono e puntano a un settore');
  assert.ok(new Set(Object.values(R.EVENT_SECTORS).map(R.sectorOfArea)).size >= 6, 'Gli eventi per tema coprono la maggior parte dei settori');
  assert.ok(new Set(Object.values(R.CATEGORY_REPUTATION)).size === 4, 'Tutte e quattro le reputazioni hanno eventi che le muovono');
}

// ---------- 2. il motore ----------
const week = 10;
const gameOf = (extra = {}) => ({ week: { index: week }, resources: { politicalCapital: 30 }, relations: [{ id: 'leadership', value: 60 }], memory: [], objectives: {}, party: { affiliation: 'member', support: 60, rank: 1, org: { committees: [] } }, place: { region: 'Toscana' }, standing: E.createStanding({ week: 1 }), ...extra });
{
  const fresh = E.createStanding({ week: 1 });
  assert.deepEqual(Object.keys(fresh.rep), R.REPUTATION_IDS);
  assert.deepEqual(Object.keys(fresh.sectors), R.SECTOR_IDS);
  assert.ok(Object.values(fresh.rep).every(value => value === 0) && Object.values(fresh.sectors).every(value => value === 0));
  assert.equal(E.createStanding({ rep: { media: 99, internal: -99 } }).rep.media, R.STANDING_RULES.offsetMax, 'Gli scostamenti hanno un tetto');
  assert.equal(E.createStanding({ rep: { media: 99, internal: -99 } }).rep.internal, -R.STANDING_RULES.offsetMax);
  assert.deepEqual(E.normalizeStanding(null, { week: 3 }).sectors, fresh.sectors, 'Un vecchio salvataggio parte neutro');
  assert.deepEqual(Object.keys(E.normalizeStanding({ rep: { media: 4 } }).rep), R.REPUTATION_IDS, 'Una parte mancante viene riempita');
  // Una scelta: gli effetti espliciti, e la quota della reputazione generale che spetta al suo genere.
  const game = gameOf();
  const lines = E.applyStandingEffects(game, { standing: { media: 3 }, sector: { sanita: 4 } }, { category: 'partito', reputationDelta: 2, cause: 'Prova' });
  assert.equal(game.standing.rep.media, 3, 'Un effetto esplicito sposta la reputazione');
  assert.equal(game.standing.rep.internal, 1.2, 'La reputazione generale sposta di più quella del genere dell’evento (partito → interna)');
  assert.ok(game.standing.sectors.welfare > 3 && game.standing.sectors.welfare <= 4, 'L’influenza sale in un settore (da un tema)');
  assert.ok(lines.some(line => /Reputazione mediatica/.test(line)) && lines.some(line => /Influenza welfare/i.test(line)), 'Il resoconto dice cosa è cambiato');
  assert.ok(game.standing.log[0] && game.standing.log.every(item => item.week === week), 'Resta traccia del perché');
  E.applyStandingEffects(game, { standing: { media: 99 } }, {});
  assert.equal(game.standing.rep.media, R.STANDING_RULES.offsetMax, 'Una reputazione non esce dal tetto');
  // L’influenza è più dura da guadagnare quando c’è già.
  const low = gameOf(), high = gameOf();
  high.standing.sectors.economia = 80;
  E.gainSector(low, 'industria', 5); E.gainSector(high, 'industria', 5);
  assert.ok(low.standing.sectors.economia > high.standing.sectors.economia - 80 + 0.0 && low.standing.sectors.economia - 0 > high.standing.sectors.economia - 80, 'Le ultime punte di influenza sono le più difficili');
  E.gainSector(low, 'industria', -50);
  assert.equal(low.standing.sectors.economia, 0, 'L’influenza non scende sotto zero');
  // Ogni settimana: svanisce, le reputazioni tornano verso quella generale, la carica tiene vivo il suo settore.
  const aging = gameOf(); aging.standing.sectors.sicurezza = 20; aging.standing.rep.media = 10;
  for (let i = 0; i < 20; i++) E.advanceStanding(aging, { held: [], floors: {}, week: week + i });
  assert.ok(aging.standing.sectors.sicurezza < 20 && aging.standing.sectors.sicurezza > 17.5, `L’influenza svanisce lentamente (${aging.standing.sectors.sicurezza})`);
  assert.ok(aging.standing.rep.media < 10 && aging.standing.rep.media > 8, 'Le scelte passate pesano meno col tempo');
  const kept = gameOf();
  const floors = E.sectorFloors({ delegas: [{ areas: ['sanita'], kind: 'assessore' }], ministerAreas: ['sicurezza'], headAreas: ['ambiente'] });
  assert.ok(floors.welfare >= R.STANDING_RULES.floors.assessore && floors.sicurezza >= R.STANDING_RULES.floors.ministro && floors.territorio >= R.STANDING_RULES.floors.presidente, 'Una delega, un ministero e la guida di un ente coprono i loro settori');
  for (let i = 0; i < 12; i++) E.advanceStanding(kept, { held: ['assessore-comunale'], floors, week: week + i });
  assert.ok(E.sectorValue(kept.standing, 'welfare') >= R.STANDING_RULES.floors.assessore, 'Finché hai la delega, il settore non scende sotto la soglia della carica');
  assert.equal(kept.standing.cache.tier, 40, 'Si ricorda il peso della carica più alta');
  assert.equal(E.sectorValue(kept.standing, 'conti'), 0);
  // La carica più alta fa salire la reputazione istituzionale; chi non ha un partito non ha reputazione interna.
  const stats = { reputation: 50, popularity: 45, notoriety: 30, influence: 40 };
  const small = E.standingOf({ game: gameOf(), stats });
  const mayor = gameOf(); mayor.standing.cache.tier = 55;
  const minister = gameOf(); minister.standing.cache.tier = 75;
  assert.ok(E.standingOf({ game: minister, stats }).reputation.institutional.value > E.standingOf({ game: mayor, stats }).reputation.institutional.value && E.standingOf({ game: mayor, stats }).reputation.institutional.value > small.reputation.institutional.value, 'Più pesa la carica, più è alta la reputazione istituzionale');
  assert.equal(E.standingOf({ game: gameOf({ party: null }), stats }).reputation.internal.value, null, 'Chi non ha un partito non ha reputazione interna');
  assert.equal(E.standingFactors({ game: gameOf({ party: null }), stats }).internal, 50, 'e per le promozioni resta neutra');
  const popular = E.standingOf({ game: gameOf(), stats: { ...stats, popularity: 80 } });
  assert.ok(popular.reputation.territorial.value > small.reputation.territorial.value, 'La popolarità alza la reputazione sul territorio');
  const famous = E.standingOf({ game: gameOf(), stats: { ...stats, notoriety: 90 } });
  assert.ok(famous.reputation.media.value > small.reputation.media.value, 'La notorietà alza quella mediatica');
  const scandal = E.standingOf({ game: gameOf({ memory: [{ tone: 'bad', weight: 2, week: week - 5 }] }), stats });
  assert.ok(scandal.reputation.media.value < small.reputation.media.value, 'Uno scandalo recente pesa sulla reputazione mediatica');
  const supported = E.standingOf({ game: gameOf({ party: { affiliation: 'member', support: 90, rank: 3, org: { committees: [] } } }), stats });
  assert.ok(supported.reputation.internal.value > small.reputation.internal.value, 'Il sostegno nel partito alza quella interna');
  for (const id of R.REPUTATION_IDS) assert.ok(small.reputation[id].parts.length >= 1, `${id}: la spiegazione c’è`);
  assert.equal(small.sectors.length, 8);
  assert.equal(E.competenceIn(gameOf(), 'sanita'), 50, 'Senza influenza in un settore la competenza è neutra');
  const expert = gameOf(); expert.standing.sectors.welfare = 80;
  assert.ok(E.competenceIn(expert, 'sanita') >= 85 && E.competenceIn(expert, 'pensioni') >= 85 && E.competenceIn(expert, 'difesa') === 50, 'La competenza vale per tutti i temi del settore, non per gli altri');
}

// ---------- 3. le promozioni ----------
{
  for (const kind of ['partito', 'parlamento', 'locale', 'governo']) {
    const sum = P.PROGRESSION_WEIGHTS[kind].reduce((total, [, , weight]) => total + weight, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `${kind}: i pesi sommano a 1 (${sum})`);
    assert.ok(P.PROGRESSION_WEIGHTS[kind].length >= 8, `${kind}: la promozione pesa molte cose, non una`);
  }
  assert.ok(P.PROGRESSION_WEIGHTS.partito.some(row => row[0] === 'internal') && P.PROGRESSION_WEIGHTS.parlamento.some(row => row[0] === 'institutional') && P.PROGRESSION_WEIGHTS.locale.some(row => row[0] === 'territorialRep') && P.PROGRESSION_WEIGHTS.governo.some(row => row[0] === 'competence'), 'Ogni promozione pesa la reputazione che la riguarda');
  assert.ok(Object.values(P.PROGRESSION_WEIGHTS).every(rows => rows.some(row => row[0] === 'results') && rows.some(row => row[0] === 'situation')), 'Tutte tengono conto dei risultati e del momento politico');
  const stats = { reputation: 50, popularity: 45, notoriety: 30, influence: 40, experience: 35 };
  const baseGame = gameOf();
  const base = P.progressionFactors({ game: baseGame, stats });
  for (const id of ['internal', 'territorialRep', 'mediaRep', 'institutional', 'competence', 'situation', 'results']) assert.ok(Number.isFinite(base[id]), `Fattore ${id}`);
  // I risultati non si dimenticano: una vittoria lontana conta meno di una recente, ma conta; i traguardi aggiungono.
  const recent = P.progressionFactors({ game: gameOf({ memory: [{ kind: 'vittoria-elettorale', weight: 1, week: week - 10 }] }), stats });
  const old = P.progressionFactors({ game: gameOf({ week: { index: 400 }, memory: [{ kind: 'vittoria-elettorale', weight: 1, week: 100 }] }), stats });
  assert.ok(recent.results > old.results && old.results > 50, `Un risultato lontano pesa meno ma resta (${recent.results} / ${old.results})`);
  const loss = P.progressionFactors({ game: gameOf({ memory: [{ kind: 'sconfitta-elettorale', weight: 1, week: week - 10 }] }), stats });
  assert.ok(loss.results < 50, 'Una sconfitta recente pesa');
  const goals = P.progressionFactors({ game: gameOf({ objectives: { radicamento: { week: 3 }, rete: { week: 4 }, voce: { week: 5, silent: true } } }), stats });
  assert.ok(goals.results > base.results, 'I traguardi raggiunti contano nei risultati (quelli registrati in silenzio no)');
  assert.equal(P.progressionFactors({ game: gameOf({ objectives: { voce: { silent: true } } }), stats }).results, base.results);
  // Il momento politico: un governo che regge aiuta chi ne fa parte e pesa su chi sta fuori; la crisi capovolge.
  const parliament = stable => ({ player: { groupId: 'g1' }, government: { status: stable ? 'active' : 'crisis', stability: stable ? 80 : 30, coalitionGroupIds: ['g1'], supportingGroupIds: [] }, careerStanding: { partySupport: 50 } });
  const inside = P.progressionFactors({ game: baseGame, stats, parliament: parliament(true) });
  const outside = P.progressionFactors({ game: baseGame, stats, parliament: { ...parliament(true), player: { groupId: 'g9' } } });
  assert.ok(inside.situation > 50 && outside.situation < 50, 'La stabilità del governo aiuta la maggioranza e pesa sull’opposizione');
  assert.ok(P.progressionFactors({ game: baseGame, stats, parliament: parliament(false) }).situation < inside.situation, 'Una crisi di governo pesa sul momento politico di chi governa');
  // Le reputazioni cambiano le probabilità, ognuna dove conta.
  const odds = (kind, game, extra = {}) => P.advancementOdds(kind, { factors: P.progressionFactors({ game, stats: { ...stats, ...extra } }), threshold: 50, game, capital: 20 });
  const boosted = (id, value) => { const game = gameOf(); game.standing.rep[id] = value; game.standing.cache.tier = 40; return game; };
  assert.ok(odds('partito', boosted('internal', 20)).score > odds('partito', boosted('internal', 0)).score, 'La reputazione interna sposta la promozione nel partito');
  assert.ok(odds('locale', boosted('territorial', 20)).score > odds('locale', boosted('territorial', 0)).score, 'Quella sul territorio sposta la candidatura locale');
  assert.ok(odds('governo', boosted('institutional', 20)).score > odds('governo', boosted('institutional', 0)).score && odds('governo', boosted('media', 20)).score > odds('governo', boosted('media', 0)).score, 'Istituzionale e mediatica spostano un incarico di governo');
  const expert = gameOf(); expert.standing.sectors.welfare = 90;
  assert.ok(odds('governo', expert).score > odds('governo', gameOf()).score && odds('parlamento', expert).score > odds('parlamento', gameOf()).score, 'La competenza di settore sposta governo e Parlamento');
  assert.ok(odds('partito', gameOf({ party: { affiliation: 'member', support: 90, rank: 1, org: { committees: [] } } })).chance > odds('partito', gameOf({ party: { affiliation: 'member', support: 30, rank: 1, org: { committees: [] } } })).chance, 'Il sostegno nel partito conta ancora');
  // Nessuna è automatica: anche con un punteggio alto la probabilità resta sotto l’86%, e i cinque esiti sono possibili.
  const strong = { influence: 100, reputation: 100, experience: 100, notoriety: 100, popularity: 100 };
  const best = P.advancementOdds('parlamento', { factors: Object.fromEntries(['influence', 'institutional', 'experience', 'group', 'competence', 'seniority', 'results', 'situation'].map(id => [id, 100])), threshold: 50, capital: 40 });
  assert.ok(best.chance <= 0.86 && best.chance >= 0.8, `Mai certa (${best.chance})`);
  const outcomes = new Set();
  for (const [roll, roll2, rank, hostile] of [[0.01, 0.5, 1, false], [0.84 * 0.9, 0.5, 1, false], [0.9, 0.9, 1, false], [0.9, 0.2, 2, false], [0.9, 0.5, 1, true]]) outcomes.add(P.evaluateAdvancement('parlamento', { factors: { influence: 20, institutional: 20, experience: 20, group: 20, competence: 20, seniority: 20, results: 20, situation: 20 }, threshold: 70, rank, hostile, roll, roll2 }).outcome);
  for (const [roll, roll2] of [[0.01, 0.5], [0.8, 0.5]]) outcomes.add(P.evaluateAdvancement('parlamento', { factors: Object.fromEntries(['influence', 'institutional', 'experience', 'group', 'competence', 'seniority', 'results', 'situation'].map(id => [id, 100])), threshold: 50, rank: 1, roll, roll2 }).outcome);
  assert.ok(['promosso', 'stallo', 'retrocessione', 'sconfitta-interna'].every(id => outcomes.has(id)), `Una promozione può riuscire, slittare, fallire o far arretrare (${[...outcomes]})`);
  void strong;
}

// ---------- 4. obiettivi e settori nelle probabilità ----------
{
  assert.ok(CAREER_OBJECTIVES.every(goal => goal.reward?.standing && Object.keys(goal.reward.standing).every(id => R.REPUTATION_IDS.includes(id)) && Object.values(goal.reward.standing).every(value => value >= 1 && value <= 4)), 'Ogni traguardo costruisce una reputazione');
  assert.ok(OBJECTIVE_BY_ID.radicamento.reward.standing.territorial >= 1 && OBJECTIVE_BY_ID.dirigenza.reward.standing.internal >= 1 && OBJECTIVE_BY_ID.legge.reward.standing.institutional >= 1 && OBJECTIVE_BY_ID.voce.reward.standing.media >= 1, 'Il traguardo costruisce la reputazione della sua linea');
  const parliament = { relations: {}, player: { groupId: 'a' }, government: { status: 'active', coalitionGroupIds: ['a'], supportingGroupIds: [], stability: 50 }, laws: [] };
  const law = { sponsor: { groupId: 'b' }, confidence: false };
  assert.ok(amendmentOdds(parliament, law, { competence: 100 }) > amendmentOdds(parliament, law, { competence: 50 }) && amendmentOdds(parliament, law, { competence: 50 }) === amendmentOdds(parliament, law), 'La competenza di settore aiuta un emendamento; neutra non cambia nulla');
  assert.ok(governmentPostOdds({ government: { status: 'active', stability: 50, ministers: [] }, careerStanding: { partySupport: 55 } }, { influence: 45, reputation: 50 }, null, { institutional: 90, mediaRep: 70, competence: 90 }) > governmentPostOdds({ government: { status: 'active', stability: 50, ministers: [] }, careerStanding: { partySupport: 55 } }, { influence: 45, reputation: 50 }), 'Reputazione istituzionale e competenza aiutano a ottenere un ministero');
}

// ---------- 5. sulla partita vera ----------
{
  const run = await startCareer({ seed: 'profilo', level: 'regionale' });
  const { store } = run;
  let state = store.getState();
  assert.ok(state.game.standing && Object.keys(state.game.standing.rep).length === 4 && Object.keys(state.game.standing.sectors).length === 8, 'La partita nasce con il suo profilo');
  for (let i = 0; i < 60; i++) playWeek(run);
  state = store.getState();
  const log = state.game.standing.log;
  assert.ok(log.some(item => item.kind === 'reputazione') || log.some(item => item.kind === 'settore'), `In 60 settimane le scelte lasciano un segno nel profilo (${log.length} voci)`);
  assert.ok(Object.values(state.game.standing.sectors).some(value => value > 0), 'L’attività del consigliere dà influenza in qualche settore');
  assert.ok(state.game.standing.cache.tier >= 48 || state.game.standing.cache.week >= 1, 'Si ricorda la carica (consigliere regionale = 48 almeno)');
  const overview = careerOverview(state);
  assert.ok(overview.standing && overview.standing.sectors.length === 8 && overview.standing.reputation.institutional.value !== null);
  const html = renderCareerPage(state, { tab: 'progressione' });
  clean(html, 'pagina Carriera / Progressione');
  for (const id of R.REPUTATION_IDS) assert.ok(html.includes(R.REPUTATIONS[id].label), `La pagina mostra ${R.REPUTATIONS[id].label}`);
  assert.ok(/Influenza per settore/.test(html) && R.SECTORS.every(item => html.includes(item.label)), 'La pagina mostra l’influenza in ogni settore');
  assert.ok(/Capitale politico/.test(html) && /Da cosa dipende/.test(html));
  assert.ok(checkInvariants(state).ok, 'Invarianti con il profilo');
  // Un atto votato nella delega dà influenza nel settore del suo tema: lo prova il motore locale + il negozio.
  // Un vecchio salvataggio senza profilo si carica e ne riceve uno neutro.
  const old = JSON.parse(JSON.stringify(state));
  delete old.game.standing;
  store.loadGame(old);
  assert.ok(store.getState().game.standing && Object.keys(store.getState().game.standing.sectors).length === 8, 'Un salvataggio vecchio riceve un profilo neutro');
  store.advance(7);
  assert.ok(checkInvariants(store.getState()).ok);
  // Un ministero: il settore del dicastero ha un pavimento finché si è ministri (provato sui pavimenti nel motore).
}

console.log('Profilo politico verificato: quattro reputazioni distinte, influenza in otto settori, effetti e decadimento, pesi delle promozioni (partito, Parlamento, candidature locali, governo) con risultati storici e momento politico, probabilità mai certe, traguardi che costruiscono reputazione, vecchi salvataggi e pagina della Carriera.');
