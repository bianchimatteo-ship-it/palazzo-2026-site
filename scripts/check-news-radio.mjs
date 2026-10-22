// LA POLITICA 24: the paper and the radio of the game, the breaking news and the news on the Home. Engine: the radio writes a bulletin and the columns that have something to say from the
// articles of the week (every item points to a real article, a week with nothing has no bulletin, once a week); breaking news only for what weighs enough and one a week at most; the result of
// an election is news (a general election is breaking); the Home shows only recent articles that are about the career and not read yet, the heaviest first, and closing the summary marks them as read
// for good. Browser: cards with scene, category, date, outlet, headline, summary and the way to the whole story; the masthead and the logo; the radio with its items and the way to the article;
// closing the Home summary; no horizontal scroll from 320 to 1280 px.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

const KEY = 'palazzo-2026.career.v1';
const localStore = new Map();
globalThis.localStorage = { getItem: key => localStore.get(key) ?? null, setItem: (key, value) => localStore.set(key, String(value)), removeItem: key => localStore.delete(key) };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { LP24, NEWS_RULES, RADIO_PROGRAMMES, ARTICLE_CATEGORIES } = await module('src/data/simulation/news-rules.js');
const { newsroomWeek, publishFact, relevantArticles, markHomeSeen, normalizeMedia } = await module('src/core/news-engine.js');
const { illustration, lp24Logo, coverIllustration, sceneNames } = await module('src/ui/illustrations.js');
const { newsScene, newsCoverScene, articleHtml, radioHtml, paperHtml } = await module('src/ui/news-view.js');
const { createSociety } = await module('src/core/society-engine.js');

// ---------- 1. the brand and the scenes ----------
assert.equal(LP24.name, 'LA POLITICA 24'); assert.ok(LP24.paper.name && LP24.radio.name && /simulat/i.test(LP24.disclaimer) && LP24.trademarkChecked === false, 'Nome, giornale, radio, avviso di testata simulata e controllo del marchio dichiarato non fatto.');
const logo = lp24Logo('paper'), radioLogo = lp24Logo('radio');
assert.ok(/aria-label="Logo di LA POLITICA 24"/.test(logo) && /<svg/.test(logo) && logo !== radioLogo && !/<image|href=|http/.test(logo + radioLogo), 'Logo originale in SVG, due varianti, nessuna immagine esterna.');
for (const scene of ['emiciclo', 'urna', 'crisi', 'podio', 'radio', 'giornale', 'palazzo', 'borgo', 'tesoro', 'piazza']) assert.ok(illustration(scene).includes('<path') && illustration(scene).length > 400, `Illustrazione «${scene}».`);
for (const category of ARTICLE_CATEGORIES) assert.ok(newsScene({ category: category.id, tone: 'neutral', importance: 2 }), `Ogni categoria (${category.id}) ha la sua scena.`);
assert.equal(newsScene({ category: 'governo', tone: 'bad', importance: 5 }), 'crisi', 'Una crisi ha la sua scena.');
assert.equal(newsScene({ category: 'parlamento', tone: 'neutral', importance: 2 }), 'emiciclo'); assert.equal(newsScene({ category: 'elezioni', tone: 'good', importance: 4 }), 'urna');
assert.ok(ARTICLE_CATEGORIES.some(item => item.id === 'elezioni'), 'Le elezioni sono una categoria.');
// Covers: a wide set of scenes, chosen by kind of article and by its id, with backdrop and orientation that follow from the article; the same article keeps the same cover on every drawing.
assert.ok(sceneNames().length >= 20, `Almeno venti scene (${sceneNames().length}).`);
for (const scene of sceneNames()) { const svg = coverIllustration(scene, { seed: 'x' }); assert.ok(svg.includes('<path') && svg.length > 400 && !/<image|href=|http/.test(svg), `Copertina «${scene}» in SVG, senza immagini esterne.`); }
const kinds = ['legge', 'respinta', 'governo', 'dossier', 'sondaggio', 'opera', 'conti', 'elezione', 'attivita', 'mondo'];
const sample = []; for (let i = 0; i < 60; i++) { const kind = kinds[i % kinds.length], category = ARTICLE_CATEGORIES[i % ARTICLE_CATEGORIES.length].id, tone = ['good', 'bad', 'neutral'][i % 3]; sample.push({ id: `articolo-${i}-${i * 7}`, kind, category, tone, importance: 2, headline: `T${i}` }); }
const coverOf = article => { const svg = coverIllustration(newsCoverScene(article), { seed: article.id, tone: article.tone }); return svg.match(/data-cover-scene="(\w+)" data-cover-backdrop="(\w+)" data-cover-flip="(\w+)"/).slice(1).join('|'); };
assert.deepEqual(sample.map(coverOf), sample.map(coverOf), 'Stesso articolo, stessa copertina a ogni ridisegno (nessuna casualità).');
const distinct = new Set(sample.map(coverOf));
assert.ok(distinct.size >= 25, `Copertine varie: ${distinct.size} combinazioni su ${sample.length} articoli.`);
assert.ok(new Set(sample.map(article => newsCoverScene(article))).size >= 14, 'Molte scene diverse nell’uso.');
for (const kind of ['legge', 'governo', 'opera']) assert.ok(new Set(Array.from({ length: 30 }, (_, i) => newsCoverScene({ id: `a-${i}`, kind, category: 'governo', tone: 'neutral', importance: 2 }))).size >= 2, `Notizie diverse di tipo «${kind}» non hanno tutte la stessa scena.`);
assert.ok(sample.filter(article => article.tone === 'bad').every(article => ['nuvole', 'luna', 'trama'].includes(coverOf(article).split('|')[1])), 'Le cattive notizie hanno sfondi cupi, mai il sole.');
const html = articleHtml({ id: 'a1', key: 'k', week: 1, date: '2026-10-12', outlet: 'Il Meridiano', category: 'governo', kind: 'governo', headline: 'Titolo', kicker: 'Palazzo', deck: 'Sottotitolo', body: ['Testo.'], facts: [], tone: 'neutral', importance: 2 }, normalizeMedia({}), {});
assert.ok(/class="news-kicker">Palazzo</.test(html) && /data-cover-scene=/.test(html), 'L’articolo mostra occhiello e copertina.');

// ---------- 2. breaking news, elections, radio, relevance ----------
const society = createSociety({ seedText: 'redazione', date: '2026-10-12', homeRegion: 'Toscana', notoriety: 30 });
const ctxOf = (week, extra = {}) => ({ week, date: `2026-10-${String(12 + (week - 1) * 7 % 20).padStart(2, '0')}`, year: 2026, parliament: { history: [], laws: [] }, govAxis: 0, gov: null, surveys: [], lawsApplied: [], worldEvents: [], projects: [], euCalls: [], finance: null, elections: [], pollLine: null, reactionsFor: () => [], ...extra });
const fact = (key, importance, week, extra = {}) => ({ key, kind: 'governo', type: 'crisi-governo', category: 'governo', importance, tone: 'bad', week, date: '2026-10-12', text: 'La crisi si apre.', data: { type: 'crisi-governo' }, story: null, ...extra });
{
  const media = normalizeMedia(structuredClone(society.media));
  const ctx = ctxOf(1);
  publishFact(media, fact('storia:a', 5, 1), ctx);
  publishFact(media, fact('storia:b', 5, 1, { type: 'fiducia-negata', data: { type: 'fiducia-negata' } }), ctx);
  publishFact(media, fact('storia:c', 4, 1, { type: 'decreto-decaduto', category: 'parlamento', data: { type: 'decreto-decaduto' } }), ctx);
  const week1 = media.articles.filter(item => item.week === 1);
  assert.equal(week1.filter(item => item.breaking).length, 1, 'Al massimo una BREAKING NEWS a settimana.');
  assert.ok(week1.filter(item => item.breaking).every(item => item.importance >= NEWS_RULES.breakingMin), 'Solo per un fatto che pesa abbastanza.');
  assert.ok(week1.filter(item => item.importance < NEWS_RULES.breakingMin).every(item => !item.breaking), 'Un fatto minore non è mai breaking.');
  publishFact(media, fact('storia:d', 5, 2, { type: 'dimissioni-governo', data: { type: 'dimissioni-governo' } }), ctxOf(2));
  assert.equal(media.articles.filter(item => item.breaking).length, 2, 'Nella settimana dopo ce n’è un’altra, se pesa.');
  const before = media.articles.length;
  publishFact(media, fact('storia:a', 5, 3), ctxOf(3));
  assert.equal(media.articles.length, before, 'Lo stesso fatto non si ripete.');
}
{
  // an election: the result is news, a general election is breaking
  for (const [type, breaking] of [['politiche', true], ['comunali', false]]) {
    const media = normalizeMedia(structuredClone(society.media));
    const ctx = ctxOf(5, { elections: [{ key: `camp-${type}`, type, label: `Elezioni ${type}`, percent: 12.4, seats: 3, personalMandate: true, objectiveMet: true, outcomeLabel: 'Eletto', date: '2026-10-12' }] });
    const out = newsroomWeek({ ...society, media }, ctx);
    const article = out.media.articles.find(item => item.category === 'elezioni');
    assert.ok(article && /12,4%/.test(article.headline + article.body.join(' ')) && article.kind === 'elezione', `Il risultato delle ${type} è una notizia.`);
    assert.equal(article.breaking, breaking, `${type}: ${breaking ? 'è' : 'non è'} breaking.`);
    assert.ok(newsroomWeek(out, ctx).media.articles.filter(item => item.category === 'elezioni').length === 1, 'Il risultato si scrive una volta.');
  }
}
{
  // the radio
  const media = normalizeMedia(structuredClone(society.media));
  const ctx = ctxOf(7, { pollLine: { label: 'Futuro Nazionale', share: 7.8, delta: -0.4, week: 7 } });
  let out = newsroomWeek({ ...society, media }, { ...ctx, parliament: { history: [], laws: [] } });
  const articlesOf = week => out.media.articles.filter(item => item.week === week);
  let bulletins = out.media.radio.bulletins.filter(item => item.week === 7);
  assert.ok(!bulletins.some(item => item.programme === 'notiziario') || articlesOf(7).length > 0, 'Il notiziario c’è solo se ci sono articoli.');
  const poll = bulletins.find(item => item.programme === 'sondaggi');
  assert.ok(poll && /Futuro Nazionale: 7,8%/.test(poll.intro) && /in calo di 0,4 punti/.test(poll.intro) && poll.figures[0].share === 7.8, 'La rubrica sui sondaggi usa i numeri veri.');
  // a week with facts
  const withFacts = ctxOf(8, { elections: [{ key: 'camp-x', type: 'comunali', label: 'Elezioni comunali', percent: 30, seats: 5, personalMandate: true, outcomeLabel: 'Sindaco', date: '2026-10-12' }], pollLine: null });
  out = newsroomWeek(out, withFacts);
  bulletins = out.media.radio.bulletins.filter(item => item.week === 8);
  const bulletin = bulletins.find(item => item.programme === 'notiziario');
  assert.ok(bulletin && bulletin.items.length >= 1 && bulletin.items.length <= 4, 'Il notiziario ha da 1 a 4 notizie.');
  for (const entry of bulletins.flatMap(item => item.items)) { const article = out.media.articles.find(item => item.id === entry.articleId); assert.ok(article && article.headline === entry.headline, 'Ogni voce rimanda a un articolo vero, con il suo titolo.'); }
  // The one article of this week (the election) is read once in the schedule: the column from the palace does not take it again (no repeats in the same schedule).
  const read = bulletins.flatMap(item => item.items).map(entry => entry.articleId);
  assert.equal(new Set(read).size, read.length, 'Nessuna notizia è ripetuta nella scaletta della settimana.');
  assert.ok(!bulletins.some(item => item.programme === 'sondaggi'), 'Senza sondaggio la rubrica non c’è.');
  const count = out.media.radio.bulletins.length;
  out = newsroomWeek(out, withFacts);
  assert.equal(out.media.radio.bulletins.length, count, 'Una volta a settimana: richiamare la settimana non raddoppia il notiziario.');
  // the views
  const html = radioHtml({ society: out, game: { week: { index: 8 } } });
  assert.ok(/lp24-masthead/.test(html) && /Radio La Politica 24/.test(html) && /data-radio-play/.test(html) && /data-news-goto=/.test(html) && /Notiziario della settimana/.test(html) && /Il punto sui sondaggi|Dal palazzo/.test(html), 'La radio mostra la testata, la sigla, le voci con il collegamento all’articolo.');
  for (let week = 20; week < 60; week++) out = newsroomWeek(out, ctxOf(week, { pollLine: { label: 'X', share: 5, delta: 0, week } }));
  assert.ok(out.media.radio.bulletins.length <= 24, 'La radio tiene gli ultimi 24 notiziari e rubriche.');
  assert.ok(Object.keys(RADIO_PROGRAMMES).length === 4);
}
{
  // relevance on the Home
  const media = normalizeMedia(structuredClone(society.media));
  const base = { outletId: 'quotidiani', outlet: 'Il Meridiano', date: '2026-10-12', headline: 'T', deck: 'D', body: ['B'], facts: [], tone: 'neutral', edge: 'neutral', storyId: null, source: 'simulation' };
  media.articles = [
    { ...base, id: 'a-attivita', week: 10, category: 'politica', kind: 'attivita', importance: 2 },
    { ...base, id: 'a-elezioni', week: 10, category: 'elezioni', kind: 'elezione', importance: 4 },
    { ...base, id: 'a-minore', week: 10, category: 'economia', kind: 'conti', importance: 2 },
    { ...base, id: 'a-vecchia', week: 5, category: 'elezioni', kind: 'elezione', importance: 5, breaking: true },
    { ...base, id: 'a-locale-mia', week: 9, category: 'territorio', kind: 'opera', importance: 3, region: 'Toscana' },
    { ...base, id: 'a-locale-altra', week: 9, category: 'territorio', kind: 'opera', importance: 3, region: 'Puglia' },
    { ...base, id: 'a-parlamento', week: 10, category: 'parlamento', kind: 'legge', importance: 3 }
  ];
  const ids = options => relevantArticles(media, { week: 10, ...options }).map(item => item.id);
  assert.deepEqual(ids({ region: 'Toscana' }), ['a-elezioni', 'a-attivita', 'a-locale-mia'], 'Le elezioni e il tuo lavoro prima, poi il tuo territorio; non il minore, non il vecchio, non un altro territorio.');
  assert.ok(ids({ region: 'Toscana', seat: true }).includes('a-parlamento') === false || ids({ region: 'Toscana', seat: true, limit: 6 }).includes('a-parlamento'), 'Con un seggio anche il Parlamento (se pesa).');
  assert.ok(!ids({ region: 'Toscana', limit: 6 }).includes('a-minore'), 'Un articolo minore non va in Home.');
  const read = markHomeSeen({ ...society, media }, ['a-elezioni', 'a-attivita']);
  assert.deepEqual(relevantArticles(read.media, { week: 10, region: 'Toscana' }).map(item => item.id), ['a-locale-mia'], 'Dopo «Segna come lette» non tornano.');
  assert.ok(read.media.articles.some(item => item.id === 'a-elezioni' && item.homeSeen), 'L’archivio le tiene.');
  assert.ok(relevantArticles(media, { week: 14, region: 'Toscana' }).length === 0, 'Dopo due settimane escono da sole.');
}

// ---------- 3. in Chrome ----------
if (!chromeAvailable) console.log('Parte nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).');
else {
  const problems = [];
  const check = (condition, message) => { if (!condition) problems.push(message); };
  await withBrowser(async browser => {
    const { evaluate, viewport, pause, version, errors } = browser;
    await createCareerInPage(browser, { party: 'party-futuro-nazionale', group: 'cam-xix-12', weeks: 2, extra: `const s = store.getState(); s.game.resources.funds = 20000; s.game.resources.politicalCapital = 80; store.performWeeklyActivity('intervista'); store.advanceTurn(1); store.performWeeklyActivity('conferenza'); store.advanceTurn(1);` });
    await openCareer(browser);
    const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click(), true`); await pause(500); };
    const band = await evaluate(`(() => { const el = document.querySelector('#hq-news-band'); return el ? { text: el.textContent.replace(/\\s+/g, ' '), cards: el.querySelectorAll('.news-card').length, parts: [...el.querySelectorAll('.news-card')].map(card => ({ art: Boolean(card.querySelector('.news-art svg')), cat: Boolean(card.querySelector('.news-cat')), date: Boolean(card.querySelector('time[datetime]')), outlet: Boolean(card.querySelector('.news-outlet')), head: card.querySelector('.news-headline')?.textContent.length > 8, summary: card.querySelector('.news-summary')?.textContent.length > 10, full: /Leggi la storia completa/.test(card.querySelector('summary')?.textContent ?? ''), breaking: Boolean(card.querySelector('.breaking-badge')) })) } : null; })()`);
    check(band && band.cards >= 1 && band.cards <= 3 && /LA POLITICA 24/.test(band.text), `La Home mostra le notizie nuove (${band?.cards}).`);
    check(band && band.parts.every(part => part.art && part.cat && part.date && part.outlet && part.head && part.summary && part.full), 'Ogni scheda ha scena, categoria, data, testata, titolo, sintesi e il collegamento alla storia completa.');
    check(band && band.parts.every(part => !part.breaking), 'Nessun BREAKING NEWS senza un fatto che lo giustifichi.');
    const ids = await evaluate(`[...document.querySelectorAll('#hq-news-band .news-card')].map(card => card.dataset.article)`);
    await click('[data-home-news-dismiss]');
    check(!(await evaluate(`Boolean(document.querySelector('#hq-news-band'))`)), 'Chiuso il riepilogo sparisce.');
    await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.advanceTurn(1); return true; })()`); await pause(600);
    const again = await evaluate(`[...document.querySelectorAll('#hq-news-band .news-card')].map(card => card.dataset.article)`);
    check(ids.every(id => !again.includes(id)), 'Gli stessi articoli non tornano in Home la settimana dopo.');
    // the newsroom
    await click('[data-nav="notizie"]');
    const paper = await evaluate(`(() => ({ masthead: Boolean(document.querySelector('.lp24-masthead .lp24-logo')), title: document.querySelector('.lp24-masthead h2')?.textContent, tabs: [...document.querySelectorAll('[data-news-filter]')].map(b => b.dataset.newsFilter).slice(0, 2), cards: document.querySelectorAll('.news-card').length }))()`);
    await click('[data-news-filter="giornale"]');
    const front = await evaluate(`({ masthead: document.querySelector('.lp24-masthead h2')?.textContent, lead: Boolean(document.querySelector('.news-card.is-lead')), cards: document.querySelectorAll('.news-card').length, logo: Boolean(document.querySelector('.lp24-logo')) })`);
    check(front.masthead === 'La Politica 24' && front.logo && front.cards >= 1, `Il giornale ha la testata e il logo (${JSON.stringify(front)}).`);
    check(paper.tabs.join() === 'giornale,radio', 'Le schede «Il giornale» e «La radio» sono le prime.');
    await click('[data-news-filter="radio"]');
    const radio = await evaluate(`({ masthead: document.querySelector('.lp24-masthead h2')?.textContent, bulletins: document.querySelectorAll('.radio-bulletin').length, play: Boolean(document.querySelector('[data-radio-play]')), goto: document.querySelectorAll('[data-news-goto]').length, art: Boolean(document.querySelector('.radio-art')) })`);
    check(radio.masthead === 'Radio La Politica 24' && radio.bulletins >= 1 && radio.play && radio.art, `La radio ha i suoi notiziari e la sigla (${JSON.stringify(radio)}).`);
    check(radio.goto >= 1, 'Le voci del notiziario rimandano agli articoli.');
    await click('[data-radio-play]');
    check(await evaluate(`/In onda/.test(document.querySelector('[data-radio-play]')?.textContent ?? '')`), 'La sigla va in onda.');
    await click('[data-news-goto]');
    const opened = await evaluate(`({ filter: document.querySelector('[data-news-filter].active')?.dataset.newsFilter, open: Boolean(document.querySelector('.news-card details[open]')) })`);
    check(opened.filter === 'articoli' && opened.open, `Dalla radio si arriva alla storia completa (${JSON.stringify(opened)}).`);
    for (const [width, height, mobile] of [[320, 640, true], [360, 800, true], [375, 812, true], [390, 844, true], [430, 932, true], [768, 1024, true], [1024, 768, false], [1280, 800, false]]) {
      await viewport(width, height, mobile); await pause(300);
      for (const filter of ['giornale', 'radio', 'articoli']) {
        await evaluate(`(async () => { document.querySelector('[data-nav="notizie"]')?.click(); await new Promise(r => setTimeout(r, 350)); document.querySelector('[data-news-filter="${filter}"]')?.click(); await new Promise(r => setTimeout(r, 400)); return true; })()`);
        const view = await evaluate(`(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, wide: [...document.querySelectorAll('.page-wrap *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed').slice(0, 3).map(el => el.className || el.tagName), small: [...document.querySelectorAll('.news-card *, .radio-bulletin *, .lp24-masthead *')].filter(el => el.children.length === 0 && el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 11.9).length }))()`);
        check(!view.overflow, `${width}px · ${filter}: scroll orizzontale (${view.wide.join(', ')}).`);
        check(view.small === 0, `${width}px · ${filter}: testi sotto i 12 px.`);
      }
    }
    check(errors.length === 0, `Errori JavaScript: ${errors.slice(0, 3).join(' | ')}`);
  });
  if (problems.length) { console.error(`LA POLITICA 24: ${problems.length} problemi.\n${[...new Set(problems)].slice(0, 40).join('\n')}`); process.exit(1); }
}
console.log('LA POLITICA 24 verificata: nome e logo originali con avviso di testata simulata e marchio non verificato; dieci scene per categoria e crisi; BREAKING NEWS solo per ciò che pesa (una a settimana), il risultato di un’elezione è una notizia (le politiche sono breaking); la radio scrive notiziario e rubriche dagli articoli e dai numeri veri della settimana, una volta a settimana, ogni voce rimanda a un articolo; la Home mostra solo notizie recenti, non ancora lette e pertinenti, e chiuderle le toglie per sempre; schede con scena, categoria, data, testata, sintesi e storia completa; nessuno scroll orizzontale da 320 a 1280 px.');
