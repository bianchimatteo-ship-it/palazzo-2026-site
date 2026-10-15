// The newsroom of LA POLITICA 24, two additions:
//   1. the radio bulletin can be read aloud by the speech synthesis of the device itself (Web Speech API): the script is written from the bulletins of the engine, the control exists only where the device
//      has speech synthesis and an Italian voice (else it is not shown and the text of the bulletin is open on the page), start and stop work, the reading goes sentence by sentence in Italian, leaving the
//      page stops it, and nothing is downloaded or sent anywhere;
//   2. the weekly pop-up: at most one a week (also after a reload), at most three news, never the same article, story or headline twice, only recent news about the career, dismissible with a button or
//      Escape, switched off by the player's preference, not on top of the weekly report, and the news stay in the archive.
// Engine and views in Node; the pages in Chrome (320–1280 px, with a fake speech synthesis that records what it is asked to say). Browser part skipped without Chrome.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

const localStore = new Map();
globalThis.localStorage = { getItem: key => localStore.get(key) ?? null, setItem: (key, value) => localStore.set(key, String(value)), removeItem: key => localStore.delete(key) };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { weeklyPopup, normalizeMedia, POPUP_RULES } = await module('src/core/news-engine.js');
const { createSociety } = await module('src/core/society-engine.js');
const voice = await module('src/ui/radio-voice.js');
const { articleHtml, radioHtml, newsPopupHtml, popupItem } = await module('src/ui/news-view.js');
const { SETTINGS_SCHEMA } = await module('src/core/settings.js');

// ---------- 1. the script ----------
const bulletin = (week, programme, label, intro, items = [], figures = []) => ({ id: `radio-${week}-${programme}`, week, date: `2026-10-${12 + week}`, programme, label, intro, items, figures });
const item = (id, headline, extra = {}) => ({ articleId: id, headline, outlet: 'Il Meridiano', category: 'governo', breaking: false, tone: 'neutral', ...extra });
const bulletins = [
  bulletin(2, 'palazzo', 'Dal palazzo', 'Dal Parlamento, dal Governo e dalle urne.', [item('a3', 'Il Senato approva la riforma')]),
  bulletin(2, 'sondaggi', 'Il punto sui sondaggi', 'Futuro Nazionale: 7,8% nell’ultima rilevazione, in calo di 0,4 punti.', [], [{ label: 'Futuro Nazionale', share: 7.8, delta: -0.4 }]),
  bulletin(2, 'notiziario', 'Notiziario della settimana', 'Edizione straordinaria in apertura, poi le altre notizie della settimana.', [item('a1', 'Crisi di governo', { breaking: true }), item('a2', 'Manovra in Aula')]),
  bulletin(1, 'notiziario', 'Notiziario della settimana', 'Ecco le notizie della settimana 1.', [item('a0', 'Una notizia vecchia')])
];
{
  assert.deepEqual(voice.bulletinScript([]), [], 'Senza notiziari non c’è nulla da leggere.');
  assert.deepEqual(voice.bulletinScript(null), [], 'Nemmeno con un valore non valido.');
  const script = voice.bulletinScript(bulletins);
  const text = script.map(line => line.text);
  assert.match(text[0], /^Radio La Politica 24\. Notiziario della settimana 2, /, 'Si apre con la testata e la settimana.');
  assert.ok(!text.some(line => /vecchia/.test(line)), 'Si legge solo l’ultima settimana.');
  assert.ok(text.indexOf('Notiziario della settimana.') < text.indexOf('Il punto sui sondaggi.') && text.indexOf('Il punto sui sondaggi.') < text.indexOf('Dal palazzo.'), 'Nell’ordine dei programmi: notiziario, sondaggi, palazzo.');
  assert.ok(text.includes('Ultima ora. Crisi di governo. Da Il Meridiano.'), 'La breaking news è annunciata come tale.');
  assert.ok(text.some(line => /Futuro Nazionale: 7,8 per cento nell’ultima rilevazione/.test(line)) && !text.some(line => /%/.test(line)), 'La percentuale si legge «per cento», mai il simbolo.');
  assert.match(text.at(-1), /simulato.*non notizie reali/, 'Chiude dicendo che è una simulazione.');
  assert.ok(script.every(line => line.id && line.text.trim().length > 3), 'Nessuna riga vuota.');
  assert.equal(new Set(script.map(line => line.id)).size, script.length, 'Righe distinte.');
}

// ---------- 2. support, views and the reading with a fake synthesis ----------
const society = createSociety({ seedText: 'voce', date: '2026-10-12', homeRegion: 'Toscana', notoriety: 30 });
const stateWith = list => ({ society: { ...society, media: { ...normalizeMedia(structuredClone(society.media)), radio: { seq: 4, bulletins: list } } }, game: { week: { index: 2 } } });
const fakeScope = (voices = [{ name: 'Voce', lang: 'it-IT', localService: true }]) => {
  const spoken = []; let cancelled = 0, pending = null;
  class Utterance { constructor(text) { this.text = text; } }
  const synth = { getVoices: () => voices, cancel() { cancelled++; pending = null; }, speak(utterance) { spoken.push(utterance); pending = utterance; } };
  return { scope: { speechSynthesis: synth, SpeechSynthesisUtterance: Utterance }, spoken, finish: () => { const current = pending; pending = null; current?.onstart?.(); current?.onend?.(); }, cancelled: () => cancelled };
};
{
  const none = {};
  assert.equal(voice.voiceSupported(none), false, 'Senza sintesi vocale: non supportata.');
  assert.equal(voice.voiceAvailable(none), false);
  assert.equal(voice.voiceSupported({ speechSynthesis: {} }), false, 'La sintesi senza il costruttore dell’enunciato non basta.');
  assert.equal(voice.voiceAvailable(fakeScope([{ name: 'English', lang: 'en-US' }]).scope), false, 'Senza una voce italiana (ma con altre voci) la lettura sarebbe nella lingua sbagliata: niente comando.');
  assert.equal(voice.voiceAvailable(fakeScope([]).scope), true, 'Elenco di voci ancora vuoto (alcuni browser le caricano dopo): il comando resta.');
  assert.equal(voice.voiceAvailable(fakeScope().scope), true, 'Con una voce italiana: disponibile.');

  // Node has no speech synthesis: the control is hidden and the text is open
  const html = radioHtml(stateWith(bulletins));
  assert.ok(!/data-radio-speak/.test(html), 'Dove non c’è la sintesi vocale il comando non si vede.');
  assert.ok(/<details class="radio-transcript" open>/.test(html) && /Crisi di governo/.test(html.split('radio-script')[1] ?? ''), 'Il testo del notiziario c’è e si legge subito.');
  assert.ok(/la lettura ad alta voce non è disponibile/.test(html), 'E dice perché non si può ascoltare.');
  assert.ok(/data-radio-play/.test(html), 'La sigla resta.');
  assert.ok(!/NaN|undefined|\[object/.test(html), 'Senza valori non validi.');
  // with a fake synthesis in the global scope the control appears
  const fake = fakeScope();
  Object.assign(globalThis, fake.scope);
  const withVoice = radioHtml(stateWith(bulletins));
  assert.ok(/data-radio-speak/.test(withVoice) && /Ascolta il notiziario/.test(withVoice) && /aria-pressed="false"/.test(withVoice), 'Con la sintesi italiana il comando c’è, spento.');
  assert.ok(/<details class="radio-transcript" >/.test(withVoice), 'Il testo è a portata di mano ma chiuso.');
  assert.ok(!/NaN|undefined|\[object/.test(withVoice));
  assert.ok(!/data-radio-speak/.test(radioHtml(stateWith([]))), 'Senza notiziari nessun comando.');

  // the reading: sentence by sentence, in Italian, stoppable
  const script = voice.bulletinScript(bulletins);
  const states = [];
  const off = voice.onVoiceChange(change => states.push(change.status));
  assert.equal(voice.speakLines(script, { volume: 0.6, scope: fake.scope }), true, 'La lettura parte.');
  assert.equal(voice.voiceStatus(), 'speaking');
  assert.equal(fake.spoken.length, 1, 'Un enunciato alla volta.');
  assert.equal(fake.spoken[0].text, script[0].text, 'Comincia dalla prima riga.');
  assert.equal(fake.spoken[0].lang, 'it-IT', 'In italiano.');
  assert.equal(fake.spoken[0].volume, 0.6, 'Al volume scelto nelle impostazioni.');
  fake.finish();
  assert.equal(fake.spoken.length, 2, 'Finita una frase passa alla successiva.');
  assert.equal(fake.spoken[1].text, script[1].text);
  assert.equal(voice.voiceLine(), 1, 'La riga in lettura è segnata.');
  voice.stopVoice(fake.scope);
  assert.equal(voice.voiceStatus(), 'idle', 'Fermata.');
  assert.ok(fake.cancelled() >= 1, 'La sintesi viene fermata davvero.');
  fake.finish();   // (a late "end" of the cancelled sentence must not restart the reading)
  assert.equal(fake.spoken.length, 2, 'Una frase finita dopo lo stop non fa ripartire nulla.');
  // run to the end
  voice.speakLines(script, { scope: fake.scope });
  for (let i = 0; i < script.length + 2; i++) fake.finish();
  assert.equal(voice.voiceStatus(), 'idle', 'Finito il testo, la lettura si ferma da sola.');
  assert.equal(fake.spoken.slice(2).map(u => u.text).join('|'), script.map(line => line.text).join('|'), 'E ha letto tutto il testo, nell’ordine.');
  assert.ok(states.includes('speaking') && states.at(-1) === 'idle', 'I cambi di stato sono notificati.');
  assert.equal(voice.speakLines([], { scope: fake.scope }), false, 'Niente da leggere: non parte.');
  assert.equal(voice.speakLines(script, { scope: {} }), false, 'Senza sintesi: non parte, senza errori.');
  // an article read aloud: headline, paragraphs, source; its own button, its own target
  {
    const art = { id: 'a-x', headline: 'Il Senato approva la riforma', body: ['Primo paragrafo con il 12% dei voti.', 'Secondo paragrafo.'], outlet: 'Il Meridiano', category: 'governo', date: '2026-10-12', tone: 'neutral', importance: 4, facts: [], storyId: null, edge: 'neutral' };
    const lines = voice.articleScript(art);
    assert.deepEqual(lines.map(item => item.kind), ['titolo', 'testo', 'testo', 'chiusura'], 'L’articolo si legge per titolo, paragrafi e fonte.');
    assert.equal(lines[0].text, 'Il Senato approva la riforma.', 'Il titolo con un solo punto.');
    assert.ok(/12 per cento/.test(lines[1].text) && !lines.some(item => /%/.test(item.text)), 'Le percentuali si leggono «per cento».');
    assert.match(lines.at(-1).text, /Il Meridiano\. Articolo simulato/, 'La fonte e il fatto che è simulato.');
    assert.deepEqual(voice.articleScript({}), [], 'Senza un articolo non c’è nulla da leggere.');
    const media = normalizeMedia(structuredClone(society.media));
    const card = articleHtml(art, media);
    assert.ok(/data-article-speak="a-x"/.test(card) && /data-voice-target="article:a-x"/.test(card) && /aria-pressed="false"/.test(card) && /Ascolta l’articolo/.test(card), 'Con la voce, l’articolo ha il suo comando.');
    assert.equal(voice.speakLines(lines, { scope: fake.scope, what: 'article:a-x' }), true);
    assert.equal(voice.voiceTarget(), 'article:a-x', 'Si sa che cosa si sta leggendo.');
    assert.ok(/Ferma la lettura/.test(articleHtml(art, media)) && !/is-on-air[^>]*data-radio-speak/.test(radioHtml(stateWith(bulletins))), 'Il comando dell’articolo mostra «Ferma», quello del notiziario resta fermo.');
    voice.speakLines(voice.bulletinScript(bulletins), { scope: fake.scope });
    assert.equal(voice.voiceTarget(), 'bulletin', 'Avviare il notiziario ferma l’articolo e legge quello.');
    voice.stopVoice(fake.scope);
    assert.equal(voice.voiceTarget(), null, 'Fermata, nessun bersaglio.');
    assert.ok((newsPopupHtml({ items: [popupItem(art)] }).match(/data-news-popup-open="a-x"/g) ?? []).length === 1, 'Ogni notizia del pop-up porta alla sua storia.');
  }
  off();
  for (const key of ['speechSynthesis', 'SpeechSynthesisUtterance']) delete globalThis[key];
  assert.ok(!/data-article-speak/.test(articleHtml({ id: 'a-y', headline: 'T', body: ['B'], outlet: 'O', category: 'governo', date: '2026-10-12', tone: 'neutral', facts: [], edge: 'neutral' }, normalizeMedia(structuredClone(society.media)))), 'Senza sintesi vocale l’articolo non ha il comando audio.');
}

// ---------- 3. the weekly pop-up (engine) ----------
const article = (id, week, extra = {}) => ({ id, week, date: '2026-10-12', outletId: 'quotidiani', outlet: 'Il Meridiano', category: 'politica', kind: 'fatto', importance: 5, headline: `Titolo ${id}`, deck: 'D', body: ['B'], facts: [], tone: 'neutral', edge: 'neutral', storyId: null, breaking: false, source: 'simulation', ...extra });
const socWith = (articles, popup) => ({ ...society, media: { ...normalizeMedia(structuredClone(society.media)), articles, ...(popup ? { popup } : {}) } });
{
  const many = [article('a1', 5), article('a2', 5, { storyId: 'S1' }), article('a3', 5, { storyId: 'S1' }), article('a4', 5, { headline: 'Titolo a1' }), article('a5', 5, { importance: 6 }), article('a6', 5, { importance: 4 }), article('a7', 5, { importance: 2 }), article('old', 1)];
  const first = weeklyPopup(socWith(many), { week: 5 });
  assert.ok(first && first.articles.length >= 1 && first.articles.length <= POPUP_RULES.limit, `Al massimo ${POPUP_RULES.limit} notizie (${first?.articles.length}).`);
  const ids = first.articles.map(entry => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'Nessuna notizia due volte.');
  assert.ok(first.articles.filter(entry => entry.storyId === 'S1').length <= 1, 'Una sola notizia per vicenda.');
  assert.equal(new Set(first.articles.map(entry => entry.headline)).size, first.articles.length, 'Né due con lo stesso titolo.');
  assert.ok(!ids.includes('a7') && !ids.includes('old'), 'Né le minori né le vecchie.');
  assert.equal(first.articles[0].id, 'a5', 'Le più pesanti per prime.');
  assert.equal(first.society.media.popup.week, 5, 'La settimana è registrata.');
  assert.equal(weeklyPopup(first.society, { week: 5 }), null, 'La stessa settimana non si ripete.');
  const next = weeklyPopup({ ...first.society, media: { ...first.society.media, articles: [...first.society.media.articles, article('b1', 6), article('b2', 6)] } }, { week: 6 });
  assert.ok(next && next.articles.every(entry => !ids.includes(entry.id)), 'La settimana dopo non torna una notizia già mostrata.');
  assert.ok(next.articles.every(entry => ['a3', 'b1', 'b2'].includes(entry.id)), 'Solo notizie mai mostrate (le nuove e quelle rimaste fuori dal pop-up precedente).');
  assert.ok(next.articles.some(entry => entry.week === 6), 'E c’è anche qualcosa della settimana.');
  // nothing to say: the week is still recorded (one look a week)
  const quiet = weeklyPopup(socWith([article('x', 5, { importance: 1 })]), { week: 9 });
  assert.equal(quiet.articles.length, 0, 'Senza notizie rilevanti il pop-up è vuoto.');
  assert.equal(quiet.society.media.popup.week, 9, 'Ma la settimana è stata guardata.');
  // read on the Home: not offered again
  assert.equal(weeklyPopup(socWith([article('h', 5, { homeSeen: true })]), { week: 5 }).articles.length, 0, 'Una notizia già letta in Home non compare nel pop-up.');
  // bounded memory
  let soc = socWith([]);
  for (let week = 1; week <= 120; week++) soc = weeklyPopup({ ...soc, media: { ...soc.media, articles: [...soc.media.articles, article(`w${week}`, week)] } }, { week }).society;
  assert.ok(soc.media.popup.ids.length <= POPUP_RULES.keep, `La memoria dei pop-up è limitata (${soc.media.popup.ids.length}).`);
  assert.equal(weeklyPopup({ media: null }, { week: 1 }), null, 'Senza redazione: niente.');
  assert.equal(weeklyPopup(socWith([]), { week: NaN }), null, 'Con una settimana non valida: niente.');
  // the view
  const html = newsPopupHtml({ items: first.articles.map(popupItem) });
  assert.ok(/role="dialog"/.test(html) && /aria-modal="false"/.test(html) && (html.match(/<li/g) ?? []).length === first.articles.length && /data-news-popup-close/.test(html) && /data-nav="notizie"/.test(html) && /SIMULATA/.test(html), 'Il pop-up è una finestra non bloccante con le notizie, il pulsante per chiuderlo e quello per aprire Informazione.');
  assert.equal(newsPopupHtml({ items: [] }), '', 'Senza notizie nessun pop-up.');
  assert.ok((newsPopupHtml({ items: many.map(popupItem) }).match(/<li/g) ?? []).length <= 3, 'Mai più di tre voci nella vista.');
  assert.equal(SETTINGS_SCHEMA.newsPopup.default, 'on', 'Di default è attivo.');
  assert.deepEqual(SETTINGS_SCHEMA.newsPopup.options.map(([value]) => value), ['on', 'off'], 'E si può spegnere.');
}

// ---------- 4. in Chrome ----------
let browserNote = 'parte nel browser NON eseguita (Chrome non trovato)';
if (chromeAvailable) {
  const FAKE = voices => `(() => {
    window.__spoken = []; window.__cancelled = 0; let current = null;
    class U { constructor(text) { this.text = text; this.lang = ''; this.voice = null; this.volume = 1; } }
    window.SpeechSynthesisUtterance = U;
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => ${JSON.stringify(voices)}, cancel() { window.__cancelled++; current = null; }, speak(u) { window.__spoken.push({ text: u.text, lang: u.lang, volume: u.volume }); current = u; setTimeout(() => { if (current === u) { u.onstart && u.onstart(); setTimeout(() => { if (current === u) { current = null; u.onend && u.onend(); } }, 150); } }, 5); } } });
  })();`;
  const run = async (voices, body) => withBrowser(async browser => {
    if (voices === 'none') await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined }); window.SpeechSynthesisUtterance = undefined;" });
    else await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: FAKE(voices) });
    await body(browser);
  }, {});
  const clickIn = (browser, selector) => browser.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
  const openRadio = async browser => {
    await openCareer(browser);
    await clickIn(browser, '[data-nav="notizie"]'); await browser.pause(600);
    await clickIn(browser, '[data-news-filter="radio"]'); await browser.pause(600);
  };
  const career = { party: 'party-futuro-nazionale', group: 'cam-xix-12', weeks: 3, extra: `const s = store.getState(); s.game.resources.funds = 20000; s.game.resources.politicalCapital = 80; store.performWeeklyActivity('intervista'); store.advanceTurn(1);` };

  // a device with an Italian voice: the control, the reading, the stop, leaving the page, the widths
  await run([{ name: 'Voce italiana', lang: 'it-IT', localService: true }], async browser => {
    const { evaluate, pause, viewport, waitFor, errors } = browser;
    await createCareerInPage(browser, career);
    await openRadio(browser);
    assert.ok(await evaluate(`Boolean(document.querySelector('[data-radio-speak]'))`), 'Su un dispositivo con voce italiana il comando c’è.');
    assert.match(await evaluate(`document.querySelector('[data-radio-speak]').textContent`), /Ascolta il notiziario/);
    const lines = await evaluate(`document.querySelectorAll('.radio-script li').length`);
    assert.ok(lines >= 3, `Il testo del notiziario è sulla pagina (${lines} righe).`);
    await clickIn(browser, '[data-radio-speak]');
    await waitFor(() => evaluate(`window.__spoken.length >= 2`), 5000);
    assert.match(await evaluate(`document.querySelector('[data-radio-speak]').textContent`), /Ferma il notiziario/, 'Mentre legge il comando diventa «Ferma».');
    assert.equal(await evaluate(`document.querySelector('[data-radio-speak]').getAttribute('aria-pressed')`), 'true');
    assert.ok(await evaluate(`document.querySelectorAll('.radio-script li.is-reading').length === 1`), 'Una frase alla volta è segnata.');
    const spoken = await evaluate(`window.__spoken`);
    assert.ok(spoken.every(entry => entry.lang === 'it-IT' && entry.volume > 0 && entry.text.length > 3), 'In italiano, a volume udibile, frasi vere.');
    const written = await evaluate(`[...document.querySelectorAll('.radio-script li')].map(li => li.textContent.trim())`);
    assert.deepEqual(spoken.map(entry => entry.text), written.slice(0, spoken.length), 'Quello che si sente è quello che c’è scritto.');
    await clickIn(browser, '[data-radio-speak]'); await pause(300);
    assert.match(await evaluate(`document.querySelector('[data-radio-speak]').textContent`), /Ascolta il notiziario/, 'Fermato, il comando torna «Ascolta».');
    assert.ok((await evaluate(`window.__cancelled`)) >= 1, 'La sintesi viene fermata davvero.');
    const count = await evaluate(`window.__spoken.length`); await pause(300);
    assert.equal(await evaluate(`window.__spoken.length`), count, 'E non parla più.');
    // leaving the page while it reads stops it
    await clickIn(browser, '[data-radio-speak]'); await waitFor(() => evaluate(`window.__spoken.length > ${count}`), 5000);
    const before = await evaluate(`window.__cancelled`);
    await clickIn(browser, '[data-news-filter="giornale"]'); await pause(500);
    assert.ok((await evaluate(`window.__cancelled`)) > before, 'Lasciando la radio la lettura si ferma.');
    // an article read aloud, then the page changes
    await clickIn(browser, '[data-news-filter="articoli"]'); await pause(600);
    assert.ok(await evaluate(`Boolean(document.querySelector('[data-article-speak]'))`), 'Gli articoli hanno il comando per ascoltarli.');
    const spokenBefore = await evaluate(`window.__spoken.length`);
    const headline = await evaluate(`document.querySelector('[data-article-speak]').closest('.news-card').querySelector('.news-headline').textContent.trim()`);
    await clickIn(browser, '[data-article-speak]');
    await waitFor(() => evaluate(`window.__spoken.length >= ${spokenBefore + 1}`), 5000);
    assert.equal((await evaluate(`window.__spoken[${spokenBefore}].text`)).replace(/\.$/, ''), headline.replace(/[.!?]+$/, ''), 'Legge prima il titolo dell’articolo.');
    assert.match(await evaluate(`document.querySelector('[data-article-speak]').textContent`), /Ferma la lettura/, 'Mentre legge il comando dell’articolo diventa «Ferma».');
    const cancelledArticle = await evaluate(`window.__cancelled`);
    await clickIn(browser, '[data-news-filter="radio"]'); await pause(500);
    assert.ok((await evaluate(`window.__cancelled`)) > cancelledArticle, 'Lasciando l’articolo la lettura si ferma.');
    for (const [width, height, mobile] of [[320, 640, true], [360, 800, true], [375, 812, true], [390, 844, true], [430, 932, true], [768, 1024, true], [1024, 768, false], [1280, 800, false]]) {
      await viewport(width, height, mobile); await pause(300);
      await evaluate(`(async () => { document.querySelector('[data-nav="notizie"]')?.click(); await new Promise(r => setTimeout(r, 350)); document.querySelector('[data-news-filter="radio"]')?.click(); await new Promise(r => setTimeout(r, 400)); document.querySelector('.radio-transcript')?.setAttribute('open', ''); return true; })()`);
      const view = await evaluate(`({ overflow: document.documentElement.scrollWidth - innerWidth, wide: [...document.querySelectorAll('.page-wrap *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed').length, small: [...document.querySelectorAll('.radio-deck *, .radio-transcript *')].filter(el => el.children.length === 0 && el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 12).length, button: (() => { const b = document.querySelector('[data-radio-speak]'); const r = b?.getBoundingClientRect(); return r ? Math.round(r.height) : 0; })() })`);
      assert.ok(view.overflow <= 1 && view.wide === 0, `${width}px: nessuno scroll orizzontale (${view.overflow}, ${view.wide}).`);
      assert.equal(view.small, 0, `${width}px: testi di almeno 12 px.`);
      assert.ok(view.button >= 36, `${width}px: il comando si tocca (${view.button}px).`);
    }
    assert.deepEqual(errors, [], `Errori in pagina: ${errors.slice(0, 2).join(' | ')}`);
  });

  // a device without speech synthesis, and one without an Italian voice: no control, the text is there
  for (const [label, voices] of [['senza sintesi vocale', 'none'], ['senza voce italiana', [{ name: 'English', lang: 'en-US' }]]]) {
    await run(voices, async browser => {
      await createCareerInPage(browser, career);
      await openRadio(browser);
      assert.ok(!(await browser.evaluate(`Boolean(document.querySelector('[data-radio-speak]'))`)), `${label}: il comando non si vede.`);
      assert.ok(await browser.evaluate(`Boolean(document.querySelector('.radio-transcript[open]')) && document.querySelectorAll('.radio-script li').length >= 3`), `${label}: il testo del notiziario è aperto sulla pagina.`);
      assert.ok(await browser.evaluate(`Boolean(document.querySelector('[data-radio-play]'))`), `${label}: la sigla resta.`);
      await clickIn(browser, '[data-news-filter="articoli"]'); await browser.pause(600);
      assert.ok(await browser.evaluate(`document.querySelectorAll('.news-card').length >= 1 && !document.querySelector('[data-article-speak], [data-voice-target]')`), `${label}: gli articoli ci sono, senza comando audio.`);
      assert.deepEqual(browser.errors, [], `${label}: nessun errore.`);
    });
  }

  // the weekly pop-up. The news are written into the save (the way a played week would leave them) and the game is loaded from it, as a player coming back would.
  const KEY = 'palazzo-2026.career.v1';
  const seedSave = (browser, count, tag) => browser.evaluate(`(() => { const saved = JSON.parse(localStorage.getItem('${KEY}')); const media = saved.society.media; const week = saved.game.week.index;
      for (let i = 0; i < ${count}; i++) media.articles.unshift({ id: 'pop-${tag}-' + i, week, date: saved.clock.currentDate, outletId: 'quotidiani', outlet: 'Il Meridiano', category: 'politica', kind: 'fatto', headline: 'Notizia ${tag}-' + i, deck: 'D', body: ['B'], facts: [], tone: 'neutral', edge: 'neutral', storyId: (i === 1 || i === 2) ? 'S-${tag}' : null, breaking: false, importance: 6, source: 'simulation' });
      localStorage.setItem('${KEY}', JSON.stringify(saved)); return week; })()`);
  const setSettings = (browser, settings) => browser.evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify(${JSON.stringify(settings)})), true`);
  const reload = async browser => { await browser.goto(); await browser.waitFor(() => browser.evaluate('Boolean(document.querySelector("[data-menu=continua]"))')); await browser.evaluate('document.querySelector("[data-menu=continua]").click(), true'); await browser.waitFor(() => browser.evaluate('Boolean(document.querySelector(".page-wrap"))')); await browser.pause(600); };
  const popup = browser => browser.evaluate(`(() => { const el = document.querySelector('[data-news-popup]'); return el ? { items: [...el.querySelectorAll('.news-popup-list li')].map(li => li.querySelector('b').textContent), dialog: el.getAttribute('role'), focus: el.contains(document.activeElement) } : null; })()`);
  const savedPopup = browser => browser.evaluate(`JSON.parse(localStorage.getItem('${KEY}')).society.media.popup ?? null`);

  await run([{ name: 'Voce italiana', lang: 'it-IT', localService: true }], async browser => {
    const { evaluate, pause, viewport } = browser;
    await createCareerInPage(browser, { party: 'party-futuro-nazionale', group: 'cam-xix-12', weeks: 1 });
    await setSettings(browser, { weeklyReport: 'on', newsPopup: 'on' });
    const week = await seedSave(browser, 6, 'a');
    await reload(browser);
    // the week with several news: at most three, no repeats, a dialog that does not take the focus
    const first = await popup(browser);
    assert.ok(first, 'La settimana con notizie rilevanti ha il suo pop-up.');
    assert.ok(first.items.length >= 1 && first.items.length <= 3, `Al massimo tre notizie (${first.items.length}).`);
    assert.equal(new Set(first.items).size, first.items.length, 'Nessuna notizia ripetuta.');
    assert.equal(first.items.filter(title => /^Notizia a-[12]$/.test(title)).length <= 1, true, 'Una sola notizia per vicenda.');
    assert.equal(first.dialog, 'dialog');
    assert.equal(first.focus, false, 'Il pop-up non ruba il cursore.');
    assert.equal((await savedPopup(browser)).week, week, 'La settimana guardata è nel salvataggio.');
    assert.ok(!/NaN|undefined|\[object/.test(await evaluate(`document.querySelector('[data-news-popup]').textContent`)), 'Senza valori non validi.');
    await evaluate(`document.querySelector('[data-news-popup-close]').click(), true`); await pause(300);
    assert.equal(await popup(browser), null, 'Si chiude con il pulsante.');
    // once a week: another page, a reload, even new news of the same week: no second pop-up
    await evaluate(`document.querySelector('[data-nav="elezioni"]')?.click(), document.querySelector('[data-nav="panoramica"]')?.click(), true`); await pause(500);
    assert.equal(await popup(browser), null, 'Cambiando pagina non ne arriva un altro.');
    await seedSave(browser, 4, 'b');
    await reload(browser);
    assert.equal(await popup(browser), null, 'Nemmeno ricaricando la partita, nemmeno con notizie nuove della stessa settimana.');
    // next week: the weekly report first, the pop-up after it (never on top of it), and no news shown before
    await evaluate(`document.querySelector('[data-action="advance"]').click(), true`); await pause(1000);
    assert.ok(await evaluate(`Boolean(document.querySelector('.report-modal'))`), 'A fine settimana si apre il resoconto.');
    assert.equal(await popup(browser), null, 'Con il resoconto aperto il pop-up aspetta.');
    await evaluate(`document.querySelector('[data-report-close]').click(), true`); await pause(600);
    const second = await popup(browser);
    assert.ok(second, 'Chiuso il resoconto arriva il pop-up della settimana nuova.');
    assert.ok(second.items.length <= 3 && second.items.every(title => !first.items.includes(title)), `Solo notizie non ancora mostrate, al massimo tre (${second.items.join(' | ')}).`);
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), true`); await pause(300);
    assert.equal(await popup(browser), null, 'Escape lo chiude.');
    assert.ok((await evaluate(`JSON.parse(localStorage.getItem('${KEY}')).society.media.articles.filter(a => a.id.startsWith('pop-')).length`)) >= 10, 'Le notizie restano nell’archivio.');
    // "Leggi la storia" opens that article in the newsroom
    await seedSave(browser, 3, 'story');
    await reload(browser);
    await evaluate(`document.querySelector('[data-action="advance"]').click(), true`); await pause(1000);
    await evaluate(`document.querySelector('[data-report-close]')?.click(), true`); await pause(600);
    const withStory = await popup(browser);
    if (withStory) {
      const wanted = await evaluate(`document.querySelector('[data-news-popup-open]').dataset.newsPopupOpen`);
      await evaluate(`document.querySelector('[data-news-popup-open]').click(), true`); await pause(900);
      assert.equal(await popup(browser), null, '«Leggi la storia» chiude il pop-up…');
      assert.ok(await evaluate(`Boolean(document.querySelector('.news-page'))`), '…porta alla redazione…');
      assert.equal(await evaluate(`document.querySelector('.news-card details[open]')?.closest('.news-card')?.dataset.article ?? null`), wanted, '…e apre proprio quell’articolo.');
    }
    // "Apri Informazione" closes it and goes to the newsroom
    await seedSave(browser, 3, 'c');
    await reload(browser);
    await evaluate(`document.querySelector('[data-action="advance"]').click(), true`); await pause(1000);
    await evaluate(`document.querySelector('[data-report-close]')?.click(), true`); await pause(600);
    if (await popup(browser)) {
      await evaluate(`document.querySelector('[data-news-popup] [data-nav="notizie"]').click(), true`); await pause(700);
      assert.equal(await popup(browser), null, '«Apri Informazione» chiude il pop-up…');
      assert.ok(await evaluate(`Boolean(document.querySelector('.news-page'))`), '…e porta alla redazione.');
    }
    // on a phone the pop-up sits inside the screen and above the bottom bar, and does not push the page sideways
    await viewport(390, 844, true); await pause(300);
    await seedSave(browser, 4, 'd');
    await reload(browser);
    await evaluate(`document.querySelector('[data-action="advance"]')?.click(), document.querySelector('[data-mobile-advance]')?.click(), true`); await pause(1000);
    await evaluate(`document.querySelector('[data-report-close]')?.click(), true`); await pause(600);
    const phone = await evaluate(`(() => { const el = document.querySelector('[data-news-popup]'); if (!el) return null; const r = el.getBoundingClientRect(), bar = document.querySelector('.mobile-tabbar')?.getBoundingClientRect(); return { inside: r.left >= 0 && r.right <= innerWidth + 1, aboveBar: !bar || r.bottom <= bar.top + 1, overflow: document.documentElement.scrollWidth - innerWidth }; })()`);
    assert.ok(phone, 'Anche su telefono il pop-up arriva.');
    assert.ok(phone.inside && phone.aboveBar && phone.overflow <= 1, `Su telefono il pop-up sta nello schermo e sopra la barra (${JSON.stringify(phone)}).`);
    assert.deepEqual(browser.errors, [], `Errori in pagina: ${browser.errors.slice(0, 2).join(' | ')}`);
  });

  // switched off by the player: nothing, and the week is not consumed
  await run([{ name: 'Voce italiana', lang: 'it-IT', localService: true }], async browser => {
    const { evaluate, pause } = browser;
    await createCareerInPage(browser, { party: 'party-futuro-nazionale', group: 'cam-xix-12', weeks: 1 });
    await setSettings(browser, { weeklyReport: 'off', newsPopup: 'off' });
    await seedSave(browser, 5, 'off');
    await reload(browser);
    assert.equal(await popup(browser), null, 'Con la preferenza spenta non compare nulla.');
    assert.equal(await savedPopup(browser), null, 'E la settimana non viene consumata.');
    await setSettings(browser, { weeklyReport: 'off', newsPopup: 'on' });
    await reload(browser);
    assert.ok(await popup(browser), 'Riaccesa la preferenza, il pop-up della settimana arriva.');
    assert.deepEqual(browser.errors, [], 'Nessun errore.');
  });
  browserNote = 'in Chrome (voce italiana, senza sintesi, senza voce italiana, pop-up di una settimana e della successiva, preferenza spenta, otto larghezze da 320 a 1280 px)';
}
console.log(`Notiziario a voce e pop-up settimanale verificati: il copione si scrive dai notiziari del motore (ultima settimana, programmi in ordine, breaking annunciata, «per cento», chiusura che dice che è simulato); il comando c’è solo con sintesi vocale e voce italiana, legge una frase alla volta in italiano al volume scelto, si ferma con il comando, con la navigazione e senza ripartire da una frase tardiva; anche un articolo scelto si legge (titolo, paragrafi, fonte) col suo comando, che si ferma lasciando la pagina; senza sintesi o voce il testo è aperto sulla pagina e gli articoli non hanno comando audio; il pop-up è uno a settimana (anche dopo il ricaricamento), al massimo tre notizie, senza ripetizioni di notizia, vicenda o titolo, solo recenti e non già lette, mai prima del resoconto, si chiude con pulsante o Escape, ogni notizia del pop-up apre la sua storia nella redazione, rispetta la preferenza; ${browserNote}.`);
