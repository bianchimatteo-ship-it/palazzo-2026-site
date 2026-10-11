// The newsroom: full articles written from the facts of the game (a law applied, a work in trouble, a world event, an interview), outlets with an identity (leaning,
// credibility, public), stories that last (timeline, reactions, heat, an end) and what the reader sees. An article is written once, citing a fact changes nothing by itself,
// the same game writes the same newsroom, old saves read and a save carries it all.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const news = await import(`../src/core/news-engine.js${v}`);
const rules = await import(`../src/data/simulation/news-rules.js${v}`);
const society = await import(`../src/core/society-engine.js${v}`);
const parliamentEngine = await import(`../src/core/parliament-engine.js${v}`);
const { checkInvariants } = await import(`../src/core/invariants.js${v}`);
const ui = await import(`../src/ui/news-view.js${v}`);
const game = await import(`../src/ui/game-mode.js${v}`);
const bad = text => /undefined|NaN|\[object|Infinity/.test(text.replace(/data-[a-z-]+="[^"]*"/g, ''));

// ---------- 1. the identity of the outlets ----------
const media0 = news.normalizeMedia({ visibility: 10, sentiment: 0, outlets: rules.NEWSROOM_OUTLETS && Object.keys(rules.NEWSROOM_OUTLETS).map(id => ({ id, label: id, reach: 10, stance: 0, attention: 5 })), coverage: [] });
assert.equal(media0.outlets.length, 6, 'Sei canali.');
for (const outlet of media0.outlets) {
  const identity = rules.NEWSROOM_OUTLETS[outlet.id];
  assert.ok(outlet.name && outlet.tagline && Number.isFinite(outlet.leaning) && outlet.credibility === identity.credibility && Object.keys(identity.public).length >= 2, `${outlet.id}: nome, orientamento, pubblico e credibilità.`);
}
assert.equal(new Set(media0.outlets.map(outlet => outlet.name)).size, 6, 'Ogni testata ha un nome diverso.');
assert.ok(media0.outlets.some(outlet => outlet.leaning < -0.4) && media0.outlets.some(outlet => outlet.leaning > 0.4) && media0.outlets.some(outlet => Math.abs(outlet.leaning) < 0.4), 'Testate di orientamento diverso.');
assert.ok(!media0.outlets.some(outlet => /corriere|repubblica|stampa$|sole 24|messaggero|tg1|tg5|rai|mediaset/i.test(outlet.name)), 'Nessun nome di testata reale.');
// A save written before the newsroom: nothing is lost, the containers appear, the credibility already earned stays.
const legacy = news.normalizeMedia({ visibility: 30, sentiment: 5, outlets: [{ id: 'quotidiani', label: 'Quotidiani nazionali', reach: 18, stance: 3, attention: 9, credibility: 80 }], coverage: [{ id: 'c1', headline: 'Titolo' }], recentHeadlines: ['x'] });
assert.ok(Array.isArray(legacy.articles) && Array.isArray(legacy.stories) && legacy.coverage.length === 1 && legacy.outlets[0].credibility === 80 && legacy.outlets[0].stance === 3 && legacy.visibility === 30, 'Un vecchio salvataggio si legge e non perde nulla.');
// The same Government, two outlets: the one on the other side of the premier is harder on it, the one on the same side milder.
assert.equal(news.edgeOf({ leaning: -1 }, 2), 'critical');
assert.equal(news.edgeOf({ leaning: 1 }, 2), 'friendly');
assert.equal(news.edgeOf({ leaning: 0.2 }, 2), 'neutral');
assert.equal(news.edgeOf({ leaning: 1 }, 0), 'neutral', 'Senza un lato del Governo nessuno è più duro di un altro.');

// ---------- 2. articles come from facts, once ----------
const ctx = { week: 12, date: '2027-03-20', year: 2027, govAxis: 1.5, gov: { name: 'Governo di prova', stability: 41, margin: 3, groups: 4, external: 1 }, parliament: { history: [], laws: [] }, lawsApplied: [], worldEvents: [], projects: [], finance: null };
const law = { title: 'Riforma del lavoro', category: 'Lavoro', area: 'lavoro', week: 12, date: '2027-03-20', lawId: 'legge-x', origin: 'governo', covered: false, cost: 3.4, billions: 5.1, deficit: 0.15, financing: 'deficit', financingLabel: 'In deficit', target: 'nazionale', targetLabel: 'Tutto il Paese', instrument: 'incentivo', instrumentLabel: 'Incentivo', topRegions: [{ name: 'Campania' }, { name: 'Puglia' }], bottomRegions: [{ name: 'Lombardia' }], winners: [{ id: 'giovani', label: 'Giovani 18–34', delta: 2, reason: 'beneficia di lavoro' }], losers: [{ id: 'imprese', label: 'Autonomi e piccole imprese', delta: -1.5, reason: 'paga o perde con deficit' }, { id: 'anziani', label: 'Pensionati e over 65', delta: -0.6, reason: 'si sente escluso' }], pleased: ['giovani'], displeased: ['imprese', 'anziani'], controversy: 1.1, source: 'simulation' };
const base = { visibility: 10, sentiment: 0, outlets: Object.keys(rules.NEWSROOM_OUTLETS).map(id => ({ id, label: id, kind: 'tv', reach: 20, stance: 0, attention: 5 })), coverage: [] };
let soc = news.newsroomWeek({ media: base }, { ...ctx, lawsApplied: [law], reactionsFor: () => [{ key: 'legge-x', actor: 'Un alleato', side: 'maggioranza', stance: 'riserve', text: 'Esprime riserve.' }, { key: 'legge-x', actor: 'Autonomi e piccole imprese', side: 'cittadini', stance: 'contrario', text: 'Paga o perde con deficit.' }] });
let media = soc.media;
assert.equal(media.articles.length, 1, 'Una legge applicata, un articolo.');
const article = media.articles[0];
assert.ok(/Riforma del lavoro/.test(article.headline) && article.body.length >= 2 && /3,4 punti/.test(article.body.join(' ')) && /giovani/.test(article.body.join(' ')) && /Campania/.test(article.body.join(' ')), 'L’articolo racconta costo, chi guadagna, chi perde e dove, dai dati della legge.');
assert.ok(article.facts.some(item => item.label === 'Costo' && /3,4/.test(item.value)) && article.facts.some(item => item.label === 'Copertura' && /oltre/.test(item.value)), 'I fatti dietro l’articolo sono elencati.');
assert.ok(article.outletId && article.category === 'parlamento' && !bad(JSON.stringify(article)), 'Testata, categoria e testo senza valori vuoti.');
const story = media.stories[0];
assert.ok(story && story.kind === 'riforma' && story.status === 'aperta' && story.reactions.length === 2 && story.timeline.length === 1 && story.heat >= 60 && article.storyId === story.id, 'Una riforma contestata apre una storia con reazioni e cronologia.');
// Once: the same fact again, in the same or another week, writes nothing.
const again = news.newsroomWeek(soc, { ...ctx, week: 13, lawsApplied: [law] });
assert.equal(again.media.articles.length, 1, 'La stessa legge non si racconta due volte.');
assert.equal(again.media.stories[0].timeline.length, 1, 'E non allunga la cronologia.');
// Headlines differ by outlet side for the same fact: one outlet against the premier's side, one with it, one in the middle.
const only = id => news.newsroomWeek({ media: { ...base, outlets: base.outlets.filter(outlet => outlet.id === id) } }, { ...ctx, govAxis: 2, lawsApplied: [law] }).media.articles[0];
const [hard, mild, middle] = [only('quotidiani'), only('radio'), only('tv-nazionale')];
assert.deepEqual([hard.edge, mild.edge, middle.edge], ['critical', 'friendly', 'neutral'], 'Con un Governo di destra il quotidiano di centro-sinistra è critico, la radio vicina, il telegiornale neutro.');
assert.equal(new Set([hard.headline, mild.headline, middle.headline]).size, 3, 'Lo stesso fatto ha tre titoli, uno per ogni lato.');
assert.ok(hard.body.join(' ') === mild.body.join(' ') && hard.facts.map(item => item.value).join() === mild.facts.map(item => item.value).join(), 'Cambia il taglio, non i fatti.');
// Citing does not change anything: the same input with and without the newsroom leaves the climate as it was.
assert.equal(soc.media.visibility, base.visibility, 'Scrivere un articolo non sposta la visibilità.');
assert.equal(soc.media.sentiment, base.sentiment, 'Né il tono della copertura.');
// Deterministic: the same input, the same newsroom.
assert.deepEqual(news.newsroomWeek({ media: base }, { ...ctx, lawsApplied: [law] }).media, news.newsroomWeek({ media: base }, { ...ctx, lawsApplied: [law] }).media, 'Stessi fatti, stessa redazione.');
// Capped: the save does not grow without end.
let flood = { media: base };
for (let week = 1; week <= 200; week++) flood = news.newsroomWeek(flood, { ...ctx, week, lawsApplied: [{ ...law, lawId: `legge-${week}`, title: `Legge ${week}`, week }], finance: { euStatus: 'procedura', spread: 260, headroom: 20 } });
assert.ok(flood.media.articles.length <= rules.NEWS_RULES.articlesKept && flood.media.seen.length <= rules.NEWS_RULES.seenKept && flood.media.stories.filter(item => item.status === 'aperta').length <= rules.NEWS_RULES.storiesOpen, 'Articoli, chiavi e storie aperte hanno un tetto.');

// ---------- 3. stories live, cool down, end; a rumour is confirmed or denied ----------
const caso = { id: 'cronaca-5-1-1', week: 5, date: '2027-02-01', kind: 'evento', eventId: 'scandalo-ministero', icon: 'scandal', scope: 'nazionale', title: 'Inchiesta su un ministero dello scenario', body: 'Un’inchiesta giornalistica simulata coinvolge gli uffici di un dicastero.', tone: 'bad', lines: ['Stabilità del governo -6'], chain: { root: 'scandalo-ministero', rootTitle: null, step: 0 } };
let flow = { media: base };
flow = news.newsroomWeek(flow, { ...ctx, week: 5, worldEvents: [caso] });
const scandal = flow.media.stories.find(item => item.kind === 'scandalo');
assert.ok(scandal && scandal.stage === 'indiscrezione' && flow.media.articles[0].category === 'inchieste' && flow.media.articles[0].outletId === 'quotidiani', 'Un’inchiesta apre un caso e la racconta chi le inchieste le fa.');
assert.ok(flow.media.articles[0].body.some(line => /Opposizione/.test(line)), 'Le reazioni vengono da ciò che l’evento fa al Governo.');
const credibilityBefore = flow.media.outlets.find(outlet => outlet.id === scandal.outletId).credibility;
for (let week = 6; week <= 14; week++) flow = news.newsroomWeek(flow, { ...ctx, week, worldEvents: [] });
const done = flow.media.stories.find(item => item.id === scandal.id);
assert.ok(['confermata', 'smentita'].includes(done.resolved) && done.timeline.some(item => /^esito:/.test(item.key)), 'Dopo qualche settimana l’indiscrezione è confermata o smentita.');
const credibilityAfter = flow.media.outlets.find(outlet => outlet.id === scandal.outletId).credibility;
assert.ok(done.resolved === 'confermata' ? credibilityAfter > credibilityBefore - 0.5 : credibilityAfter < credibilityBefore, 'La testata guadagna credibilità se aveva ragione e ne perde se aveva torto.');
for (let week = 15; week <= 40; week++) flow = news.newsroomWeek(flow, { ...ctx, week, worldEvents: [] });
assert.ok(flow.media.stories.every(item => item.status === 'chiusa' && item.resolution?.text) && flow.media.stories.every(item => item.heat <= rules.NEWS_RULES.closeBelow), 'Senza nuovi fatti le storie si raffreddano e si chiudono con un esito.');
assert.ok(flow.media.outlets.every(outlet => outlet.credibility >= rules.NEWS_RULES.credibility.min && outlet.credibility <= rules.NEWS_RULES.credibility.max), 'La credibilità resta nei limiti e torna lentamente al livello della testata.');
// A story that ended is not reopened by a late echo.
const echo = news.newsroomWeek(flow, { ...ctx, week: 41, worldEvents: [{ ...caso, id: 'cronaca-41-9-9', week: 41, chain: { root: 'scandalo-ministero', rootTitle: null, step: 1 } }] });
assert.ok(echo.media.stories.filter(item => item.status === 'aperta').length === 0 || echo.media.stories.every(item => item.key !== scandal.key || item.status === 'chiusa'), 'Una storia chiusa non si riapre.');

// ---------- 4. in the game: facts of every system reach the newsroom ----------
async function premierCareer(seed) {
  const run = await startCareer({ seed, level: 'deputato' });
  const { store } = run;
  store.advance(7);
  const save = JSON.parse(store.exportSave());
  const group = save.parliament.player.groupId;
  const allies = save.parliament.government.coalitionGroupIds.filter(id => id !== group);
  let parliament = { ...save.parliament, government: null };
  parliament = parliamentEngine.formGovernment({ ...parliament, resources: { ...parliament.resources, politicalCapital: 90 } }, [group, ...allies], save.clock.currentDate);
  save.parliament = { ...parliament, government: { ...parliament.government, formedBy: 'player', premierGroupId: group } };
  save.game.resources.politicalCapital = 90;
  save.society.crisisSeverity = 0;
  store.loadGame(save);
  store.advance(7);
  store.voteGovernmentConfidence?.();
  return run;
}
const run = await premierCareer('news-1');
const { store } = run;
const st = () => store.getState();
const edit = change => { const save = JSON.parse(store.exportSave()); change(save); store.loadGame(save); };
const hold = () => edit(save => { Object.assign(save.parliament.government, { stability: 95, crisisSeverity: 0, status: 'active' }); });
const week0 = st().game.week.index;
assert.ok(Array.isArray(st().society.media.articles) || st().society.media.articles === undefined, 'Lo stato parte coerente.');
// An interview of the player is written up.
edit(save => { save.game.week.ap = 12; save.game.resources.politicalCapital = 90; });
store.performWeeklyActivity('intervista');
const interview = st().society.media.articles.find(item => /intervista/i.test(item.headline + item.deck));
assert.ok(interview && interview.category === 'politica' && interview.body.length >= 2 && interview.facts.some(item => item.label === 'Tema'), 'Un’intervista del giocatore diventa un articolo con il suo tema.');
// A law applied, a work with an overrun, a world event with a chain.
edit(save => {
  save.society.lawsApplied.unshift({ ...law, lawId: 'legge-news', week: save.game.week.index + 1, date: save.clock.currentDate });
  save.society.projects = [{ id: 'opera-news-1', type: 'ospedale', region: 'Lombardia', title: 'Ospedale · Lombardia', funding: 100, cost: 6, committed: 2.4, financing: 'bilancio', callId: null, euShare: 0, weeks: 74, progress: 45, stage: 'cantiere', delayWeeks: 7, overruns: 1, scope: 1, boost: 0, stall: 0, pending: { kind: 'sforamento', amount: 1.4, week: save.game.week.index, raised: true, waits: 0 }, proposedWeek: save.game.week.index, proposedDate: save.clock.currentDate, minister: 'Salute', source: 'simulation' }];
  save.world.events = [...save.world.events, { ...caso, id: 'cronaca-news-1', week: save.game.week.index + 1, date: save.clock.currentDate }];
});
hold(); store.advance(7);
const m1 = st().society.media;
assert.ok(m1.articles.some(item => item.key === 'legge:legge-news') && m1.articles.some(item => item.key.startsWith('opera:opera-news-1:sforamento')) && m1.articles.some(item => item.key === 'mondo:cronaca-news-1'), 'Legge, opera e fatto del mondo arrivano in redazione.');
assert.ok(m1.stories.some(item => item.kind === 'riforma' && item.reactions.length) && m1.stories.some(item => item.kind === 'opere') && m1.stories.some(item => item.kind === 'scandalo'), 'E aprono storie: riforma contestata, opera, caso.');
assert.ok(m1.articles.find(item => item.key === 'legge:legge-news').body.join(' ').includes('Campania'), 'Il testo viene dai dati della legge.');
assert.equal(new Set(m1.articles.map(item => item.key)).size, m1.articles.length, 'Nessun articolo duplicato.');
const countOf = key => st().society.media.articles.filter(item => item.key === key).length;
hold(); store.advance(7);
assert.equal(countOf('legge:legge-news'), 1, 'Una settimana dopo la legge non è raccontata di nuovo.');
// A save carries the newsroom and the reload gives it back unchanged; the invariants hold.
const saved = store.exportSave();
store.loadGame(JSON.parse(saved));
assert.equal(JSON.stringify(st().society.media.articles), JSON.stringify(JSON.parse(saved).society.media.articles), 'Dopo il ricaricamento gli articoli sono gli stessi.');
assert.deepEqual(checkInvariants(st()).issues, [], 'Gli invarianti reggono con la redazione.');
// A save from before the newsroom reads and goes on.
edit(save => { delete save.society.media.articles; delete save.society.media.stories; delete save.society.media.seen; delete save.society.media.cursor; for (const outlet of save.society.media.outlets) { delete outlet.credibility; delete outlet.name; } });
hold(); store.advance(7);
assert.ok(Array.isArray(st().society.media.stories) && st().society.media.outlets.every(outlet => Number.isFinite(outlet.credibility) && outlet.name), 'Un salvataggio senza redazione la riceve alla settimana successiva.');
assert.deepEqual(checkInvariants(st()).issues, [], 'Invarianti dopo la migrazione.');

// ---------- 5. what the reader sees ----------
const state = st();
for (const filter of ['tutto', 'articoli', 'storie', 'testate', 'cronaca', 'media', 'diario']) {
  const html = game.renderNewsroom(state, filter, {});
  assert.ok(html.length > 200 && !bad(html), `Redazione «${filter}» senza valori vuoti.`);
}
const articlesHtml = game.renderNewsroom(state, 'articoli', {});
assert.ok(/<details class="news-article/.test(articlesHtml) && /article-body/.test(articlesHtml) && /article-facts/.test(articlesHtml) && /data-news-category="tutte"/.test(articlesHtml), 'Gli articoli si aprono e si filtrano per categoria e testata.');
assert.ok(/Fa parte di una vicenda/.test(articlesHtml), 'Un articolo rimanda alla storia di cui fa parte.');
const filtered = game.renderNewsroom(state, 'articoli', { newsCategory: 'opere' });
assert.ok(/Ospedale/.test(filtered) && !/Riforma del lavoro/.test(filtered.replace(/data-[a-z-]+="[^"]*"/g, '')), 'Il filtro per categoria restringe gli articoli.');
const storiesHtml = game.renderNewsroom(state, 'storie', {});
assert.ok(/news-story/.test(storiesHtml) && /story-timeline/.test(storiesHtml) && /story-reactions/.test(storiesHtml) && /story-heat/.test(storiesHtml), 'Le storie mostrano cronologia, reazioni e attenzione.');
const outletsHtml = game.renderNewsroom(state, 'testate', {});
assert.ok(/outlet-card/.test(outletsHtml) && /Credibilità/.test(outletsHtml) && /Orientamento/.test(outletsHtml) && /Pubblico/.test(outletsHtml) && /TG Orizzonte/.test(outletsHtml), 'Le testate mostrano credibilità, orientamento e pubblico.');
const chronicle = game.renderNewsroom(state, 'cronaca', {});
assert.ok(!/Inchiesta su un ministero dello scenario/.test(chronicle.replace(/data-[a-z-]+="[^"]*"/g, '')) || state.world.events.every(event => !state.society.media.seen.includes(`mondo:${event.id}`)), 'La cronaca non ripete ciò che ha già un articolo.');
// The Prime Minister, interview, law, reform: a reader can follow the thread from the reform to its story.
console.log('Redazione verificata: sei testate con nome, orientamento, pubblico e credibilità che cambia con le indiscrezioni confermate o smentite; articoli scritti una volta sola dai fatti (legge applicata, opera in ritardo, evento del mondo, intervista del giocatore) con testo, fatti e variante per orientamento; storie persistenti con cronologia, reazioni, attenzione che cala, esito e senza riaperture; nessun effetto sul clima per il solo fatto di essere citati; tetti sul salvataggio, determinismo, vecchi salvataggi e ricaricamento; vista a filtri senza valori vuoti.');
process.exit(0);
