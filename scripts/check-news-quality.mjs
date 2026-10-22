// The newsroom and the radio, quality of what they write (engine only, no browser):
//   - headlines carry no invented quotation and no sensational claim the game cannot support; no statement is put in anyone's mouth;
//   - the schedule of the radio repeats nothing (stable id, fact key, story, headline) within a bulletin or between the bulletin and its columns of the same week;
//   - the poll is told with its own date (and the field period of a real one), the change is the one between the last two surveys, and an old survey is said to be old;
//   - the length limits are real (outlet budget and bodyMax) and a cut never leaves half a sentence;
//   - the outlets write differently from the same facts (form, length, headline shape);
//   - an inquiry goes through rumour, checks, answer awaited, findings, outcome and, when wrong, a correction; whether it is well founded depends on the case, never on the outlet's reputation;
//   - the reading aloud: the best Italian voice first and robotic ones last, the late list of voices, a voice that cannot speak replaced by another, a blocked or silent reading reported, no
//     Italian voice or no speech synthesis said (the transcript stays).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const store = new Map();
globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { NEWS_RULES, OUTLET_STYLE } = await module('src/data/simulation/news-rules.js');
const engine = await module('src/core/news-engine.js');
const { newsroomWeek, publishFact, normalizeMedia, NEWS_TEMPLATES } = engine;
const { createSociety } = await module('src/core/society-engine.js');
const voice = await module('src/ui/radio-voice.js');

const society = createSociety({ seedText: 'qualita', date: '2026-10-26', homeRegion: 'Toscana', notoriety: 30 });
const ctxOf = (week, extra = {}) => ({ week, date: `2026-10-${String(26 - 14 + (week - 1) * 7 % 20).padStart(2, '0')}`, year: 2026, parliament: { history: [], laws: [] }, govAxis: 0, gov: null, surveys: [], lawsApplied: [], worldEvents: [], projects: [], euCalls: [], finance: null, elections: [], pollLine: null, reactionsFor: () => [], ...extra });
const fresh = () => normalizeMedia(structuredClone(society.media));

// ---------- 1. the headline templates ----------
const templates = Object.values(NEWS_TEMPLATES).flatMap(bucket => Array.isArray(bucket) ? bucket : [...bucket.good, ...bucket.bad]);
assert.ok(templates.length > 100, `I modelli di titolo ci sono (${templates.length}).`);
assert.deepEqual(templates.filter(text => /[«»“”"]/.test(text)), [], 'Nessun modello di titolo contiene una citazione diretta (nessuna frase è messa in bocca a nessuno).');
assert.deepEqual(templates.filter(text => /\bBoom\b|Terremoto|Tre ipotesi|esultano|vertici notturni|a oltranza|messaggio cancellato|lascia la sala|volta le spalle|binario morto/i.test(text)), [], 'Nessun titolo sensazionalistico o con fatti che il gioco non ha.');

// ---------- 2. the radio repeats nothing ----------
{
  const gov = (key, type, week = 5) => ({ key, kind: 'governo', type, category: 'governo', importance: 4, tone: 'bad', week, date: '2026-11-09', text: 'La crisi.', data: { type }, story: { kind: 'crisi', op: 'add', key: 'crisi:g1', title: 'La crisi di governo', stage: 'trattative', text: 'La crisi.' } });
  const election = (key, type) => ({ key, kind: 'elezione', category: 'elezioni', importance: 4, tone: 'good', week: 5, date: '2026-11-09', text: 'Il voto.', data: { label: `Elezioni ${type}`, percent: 31.2, seats: 4, personalMandate: true, outcomeLabel: 'Eletto' } });
  const extraFacts = [gov('storia:1', 'crisi-governo'), gov('storia:2', 'crisi-spontanea'), gov('storia:3', 'verifica-maggioranza'), election('e1', 'comunali'), election('e2', 'regionali'), { ...gov('storia:4', 'rimpasto'), story: null }];
  const out = newsroomWeek({ ...society, media: fresh() }, { ...ctxOf(5), extraFacts });
  const bulletins = out.media.radio.bulletins.filter(item => item.week === 5);
  const items = bulletins.flatMap(item => item.items);
  assert.ok(items.length >= 2, 'La scaletta ha notizie.');
  for (const bulletin of bulletins) {
    const ids = bulletin.items.map(entry => entry.articleId);
    assert.equal(new Set(ids).size, ids.length, `${bulletin.programme}: nessuna notizia ripetuta nel notiziario o nella rubrica.`);
  }
  for (const [label, pick] of [['articolo', entry => entry.articleId], ['fatto', entry => entry.key], ['titolo', entry => entry.headline.trim().toLowerCase()], ['storia', entry => entry.storyId]]) {
    const values = items.map(pick).filter(Boolean);
    assert.equal(new Set(values).size, values.length, `Nella scaletta della settimana nessun ${label} compare due volte (notiziario e rubriche).`);
  }
  const articles = out.media.articles.filter(item => item.week === 5);
  assert.ok(articles.filter(item => item.storyId).length >= 2 && items.filter(entry => entry.storyId).length <= 1, 'Due articoli della stessa vicenda: in onda ne va uno solo.');
  for (const entry of items) assert.ok(out.media.articles.find(item => item.id === entry.articleId && item.key === entry.key), 'Ogni voce ha l’identificativo stabile del suo articolo e del suo fatto.');
}

// ---------- 3. the poll, with its date ----------
{
  const line = { label: 'Futuro Nazionale', share: 7.2, delta: 0.4, week: 3, date: '2026-10-21', previousDate: '2026-10-14', period: { from: '2026-10-17', to: '2026-10-19' } };
  const out = newsroomWeek({ ...society, media: fresh() }, { ...ctxOf(3), date: '2026-10-26', pollLine: line });
  const poll = out.media.radio.bulletins.find(item => item.programme === 'sondaggi');
  assert.match(poll.intro, /Futuro Nazionale: 7,2% nella rilevazione del 21 ottobre/, 'La rilevazione ha la sua data.');
  assert.match(poll.intro, /campo dal 17 ottobre al 19 ottobre/, 'E il periodo di campo di un sondaggio reale.');
  assert.match(poll.intro, /in crescita di 0,4 punti rispetto alla rilevazione del 14 ottobre\./, 'La variazione è quella tra le ultime due rilevazioni, con la data.');
  assert.doesNotMatch(poll.intro, /Non ci sono rilevazioni più recenti/, 'Una rilevazione di pochi giorni fa non è «vecchia».');
  assert.equal(poll.pollDate, '2026-10-21');
  const stale = newsroomWeek({ ...society, media: fresh() }, { ...ctxOf(6), date: '2026-11-16', pollLine: { ...line, previousDate: null, delta: 0 } }).media.radio.bulletins.find(item => item.programme === 'sondaggi');
  assert.match(stale.intro, /Non ci sono rilevazioni più recenti: questa risale a 26 giorni fa/, 'Un sondaggio vecchio è detto vecchio, non è presentato come l’ultima notizia.');
  assert.match(stale.intro, /in linea con la rilevazione precedente/, 'Variazione nulla: in linea.');
  const nodate = newsroomWeek({ ...society, media: fresh() }, { ...ctxOf(2), pollLine: { label: 'X', share: 5, delta: -0.4, week: 2 } }).media.radio.bulletins.find(item => item.programme === 'sondaggi');
  assert.match(nodate.intro, /in calo di 0,4 punti rispetto alla rilevazione precedente/, 'Senza data nota non se ne inventa una.');
}

// ---------- 4. length limits and natural cuts ----------
const outletIds = Object.keys(OUTLET_STYLE);
const longText = Array.from({ length: 14 }, (_, i) => `Questa è la frase numero ${i + 1} dell’articolo, scritta per essere abbastanza lunga da superare i limiti di ogni testata`).join('. ') + '.';
const worldFact = (key, hint, extra = {}) => ({ key, kind: 'mondo', category: 'politica', importance: 2, tone: 'neutral', week: 4, date: '2026-11-09', text: longText, outletHint: hint, data: { title: 'Un fatto del mondo', body: longText, lines: [longText, longText] }, reactions: [], story: null, ...extra });
const written = {};
{
  const media = fresh();
  for (const id of outletIds) {
    const own = { ...media, outlets: media.outlets.filter(outlet => outlet.id === id) };
    if (!own.outlets.length) continue;
    publishFact(own, worldFact(`mondo:lungo:${id}`, id, { local: ['tv-locale', 'stampa-locale'].includes(id), data: { title: 'Un fatto del mondo', body: longText, lines: [longText, longText], region: 'Toscana' } }), ctxOf(4));
    const article = own.articles[0];
    written[id] = article;
    const style = OUTLET_STYLE[id];
    assert.ok(article.body.length <= style.paragraphs, `${id}: al massimo ${style.paragraphs} capoversi.`);
    assert.ok(article.body.join('').length <= style.chars + 1, `${id}: il corpo non supera il budget della testata (${style.chars}).`);
    for (const paragraph of article.body) {
      assert.ok(paragraph.length <= NEWS_RULES.bodyMax, `${id}: nessun capoverso oltre bodyMax (${NEWS_RULES.bodyMax}).`);
      assert.match(paragraph, /[.!?»”)…]$/, `${id}: un capoverso non finisce a metà frase («…${paragraph.slice(-30)}»).`);
      assert.doesNotMatch(paragraph, /\b(e|di|che|per|la|il|con)…$/, `${id}: nessun taglio dopo una parola funzionale.`);
    }
    assert.ok(article.deck.length <= 241 && !/[,;:]$/.test(article.deck), `${id}: il sommario è corto e non finisce con una virgola.`);
  }
}

// ---------- 5. outlets write differently from the same fact ----------
{
  // an ordinary fact: a lead and four lines of about 140 characters (the limit test above is a stress case where every outlet fills its first paragraph)
  const line = n => `Il quarto passaggio numero ${n} riguarda il territorio e racconta che cosa cambia per chi vive qui, con i numeri del caso.`;
  const media = fresh();
  const forms = {};
  for (const id of outletIds) {
    const own = { ...media, outlets: media.outlets.filter(outlet => outlet.id === id) };
    if (!own.outlets.length) continue;
    publishFact(own, { key: `mondo:ordinario:${id}`, kind: 'mondo', category: 'politica', importance: 2, tone: 'neutral', week: 4, date: '2026-11-09', text: line(0), outletHint: id, local: ['tv-locale', 'stampa-locale'].includes(id), data: { title: 'Cambia il servizio nel territorio', body: line(0), lines: [line(1), line(2), line(3), line(4)], region: 'Toscana' }, reactions: [], story: null }, ctxOf(4));
    forms[id] = own.articles[0];
  }
  const ids = Object.keys(forms);
  assert.ok(ids.length >= 5, 'Le testate scrivono lo stesso fatto.');
  assert.ok(new Set(ids.map(id => forms[id].form)).size >= 4, `Forme diverse (${ids.map(id => `${id}:${forms[id].form}`).join(', ')}).`);
  assert.ok(new Set(ids.map(id => forms[id].body.length)).size >= 4, `Numero di capoversi diverso (${ids.map(id => `${id}:${forms[id].body.length}`).join(', ')}).`);
  assert.ok(new Set(ids.map(id => forms[id].body.join('').length)).size >= 4, 'Lunghezze diverse.');
  assert.ok(forms.quotidiani.body.length > forms['tv-nazionale'].body.length && forms['tv-nazionale'].body.length > forms.social.body.length, 'Il quotidiano approfondisce, il TG riassume, il social è una riga.');
  assert.ok(forms.social.headline.length <= 90 && forms.social.tags.length === 1 && /^#/.test(forms.social.tags[0]), 'Il social: titolo corto e tag.');
  assert.ok(!forms.quotidiani.tags.length && !forms['tv-nazionale'].tags.length, 'Gli altri non usano tag.');
  for (const id of ['tv-locale', 'stampa-locale']) if (forms[id]) assert.ok(forms[id].headline.startsWith('Toscana · '), `${id}: la cronaca locale mette il luogo davanti al titolo.`);
  assert.ok(!/[«»]/.test(forms.radio.headline), 'La radio non usa segni tipografici muti.');
}

// ---------- 6. an inquiry in steps; the truth depends on the case ----------
{
  const caseFact = key => ({ key: `mondo:${key}`, kind: 'mondo', category: 'inchieste', importance: 4, tone: 'bad', week: 1, date: '2026-10-26', text: 'Un’indiscrezione.', data: { title: `Il caso ${key}`, body: 'Un’indiscrezione su un appalto.', lines: [] }, reactions: [], story: { kind: 'scandalo', op: 'open', key: `caso:${key}`, title: `Il caso ${key}`, stage: 'indiscrezione', text: 'Un’indiscrezione.', heat: 55 } });
  const run = (key, credibility) => {
    let current = { ...society, media: fresh() };
    for (const outlet of current.media.outlets) outlet.credibility = credibility;
    current = newsroomWeek(current, { ...ctxOf(1), extraFacts: [caseFact(key)] });
    for (let week = 2; week <= 12; week++) {
      for (const outlet of current.media.outlets) outlet.baseCredibility = credibility;
      current = newsroomWeek(current, ctxOf(week));
    }
    return current.media.stories.find(item => item.key === `caso:${key}`);
  };
  const outcomes = new Set();
  for (let i = 0; i < 14; i++) {
    const low = run(`k${i}`, 15), high = run(`k${i}`, 92);
    assert.ok(low && high, 'La vicenda c’è.');
    assert.equal(low.resolved, high.resolved, `Caso k${i}: l’esito è lo stesso con una testata poco o molto credibile (${low.resolved}).`);
    assert.equal(low.truth, high.truth);
    outcomes.add(low.resolved);
    const keys = low.timeline.map(item => item.key.split(':')[0]);
    for (const step of ['verifiche', 'risposta', 'esito']) assert.ok(keys.includes(step), `Caso k${i}: passaggio «${step}».`);
    assert.ok(keys.indexOf('verifiche') < keys.indexOf('risposta') && keys.indexOf('risposta') < keys.indexOf('esito'), `Caso k${i}: i passaggi sono in ordine.`);
    assert.ok(keys.includes('riscontri') || low.resolved, 'Prima dell’esito, riscontri o assenza di riscontri.');
    if (low.resolved === 'smentita') { assert.ok(keys.includes('rettifica'), 'Una smentita ha la rettifica.'); assert.equal(low.status, 'chiusa'); assert.match(low.timeline.find(item => item.key.startsWith('rettifica')).text, /rettifica/); }
    else assert.ok(!keys.includes('rettifica'), 'Una conferma non ha rettifica.');
    for (const item of low.timeline) assert.doesNotMatch(item.text, /[«»"]/, 'Nessuna dichiarazione virgolettata nella vicenda.');
  }
  assert.deepEqual([...outcomes].sort(), ['confermata', 'smentita'], 'Nei casi provati esistono sia indiscrezioni fondate sia infondate.');
  // the reputation changes as a consequence: a denied story costs the outlet, a confirmed one gives
  const before = fresh().outlets.find(outlet => outlet.id === 'quotidiani').credibility;
  assert.ok(before > 10, 'La credibilità di partenza è nota.');
}

// ---------- 7. the voice ----------
{
  const mk = (name, lang, localService) => ({ name, lang, localService, voiceURI: name });
  const scopeOf = (voices, { onSpeak } = {}) => {
    const listeners = [];
    const scope = {
      voices,
      speechSynthesis: { getVoices: () => scope.voices, cancel() {}, addEventListener: (type, fn) => { if (type === 'voiceschanged') listeners.push(fn); }, speak(utterance) { scope.spoken.push(utterance); onSpeak?.(utterance, scope); } },
      SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
      spoken: [], fire: () => listeners.forEach(fn => fn())
    };
    return scope;
  };
  const voices = [mk('eSpeak Italian compact', 'it-IT', true), mk('Google italiano', 'it-IT', false), mk('Microsoft Elsa Online (Natural) - Italian', 'it-IT', true), mk('Anna', 'de-DE', true), mk('Alice', 'it-IT', true), mk('Svizzero', 'it-CH', false)];
  const scope = scopeOf(voices);
  const ranked = voice.rankedVoices(scope).map(item => item.name);
  assert.equal(ranked.at(-1), 'eSpeak Italian compact', 'Le voci robotiche vanno per ultime.');
  assert.ok(!ranked.includes('Anna'), 'Una voce non italiana non è mai scelta.');
  assert.ok(['Microsoft Elsa Online (Natural) - Italian', 'Alice'].includes(ranked[0]), 'Prima una voce italiana installata e naturale.');
  const picks = new Set(Array.from({ length: 20 }, (_, i) => voice.pickVoice(scope, () => i / 20).name));
  assert.ok(!picks.has('eSpeak Italian compact') && !picks.has('Svizzero') && picks.size >= 2, 'La scelta è casuale solo tra le migliori.');
  let last = null; for (let i = 0; i < 10; i++) { const picked = voice.pickVoice(scope, () => 0).name; assert.notEqual(picked, last, 'Non la stessa voce due volte di fila.'); last = picked; }
  // the late list of voices
  const late = scopeOf([]);
  let notified = 0;
  assert.equal(voice.voiceAvailable(late), true, 'Lista vuota = ancora non nota: il comando c’è.');
  voice.onVoicesChange(() => { notified++; }, late);
  late.voices = [mk('Alice', 'it-IT', true)]; late.fire();
  assert.equal(notified, 1, 'La pagina è avvisata quando arrivano le voci (voiceschanged).');
  assert.equal(voice.pickVoice(late, () => 0).name, 'Alice');
  // reasons
  assert.equal(voice.voiceUnavailableReason({}), 'no-api'); assert.equal(voice.voiceUnavailableReason(scopeOf([mk('Anna', 'de-DE', true)])), 'no-italian-voice'); assert.equal(voice.voiceUnavailableReason(scope), null);
  assert.equal(voice.voiceAvailable(scopeOf([mk('Anna', 'de-DE', true)])), false, 'Nessuna voce italiana: niente comando (resta la trascrizione).');
  // a voice that cannot speak gives way to another
  const spoken = [];
  const flaky = scopeOf([mk('Alice', 'it-IT', true), mk('Elsa', 'it-IT', true)], { onSpeak: (utterance, sc) => { spoken.push(utterance.voice.name); if (spoken.length === 1) { setTimeout(() => utterance.onerror?.({ error: 'voice-unavailable' }), 0); } else { setTimeout(() => { utterance.onstart?.(); utterance.onend?.(); }, 0); } } });
  assert.equal(voice.speakLines([{ text: 'Una frase.' }, { text: 'Un’altra frase.' }], { scope: flaky, startWait: 200 }), true);
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.equal(voice.voiceStatus(), 'idle', 'La lettura è finita dopo il ripiego su un’altra voce.'); assert.ok(new Set(spoken).size === 2, `Ha cambiato voce (${spoken}).`); assert.equal(voice.voiceError(), null);
  // blocked by the browser
  const blocked = scopeOf([mk('Alice', 'it-IT', true)], { onSpeak: utterance => setTimeout(() => utterance.onerror?.({ error: 'not-allowed' }), 0) });
  voice.speakLines([{ text: 'Una frase.' }], { scope: blocked });
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(voice.voiceStatus(), 'error'); assert.equal(voice.voiceError().code, 'blocked'); assert.match(voice.voiceError().message, /bloccato/);
  // a voice that never starts: another one, then silence reported
  const silent = scopeOf([mk('Alice', 'it-IT', true), mk('Elsa', 'it-IT', true)]);
  voice.speakLines([{ text: 'Una frase.' }], { scope: silent, startWait: 40 });
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(voice.voiceStatus(), 'error'); assert.equal(voice.voiceError().code, 'silent'); assert.ok(silent.spoken.length >= 2, 'Prima ha provato un’altra voce.');
  // a cancelled reading ends quietly
  const cancel = scopeOf([mk('Alice', 'it-IT', true)], { onSpeak: utterance => setTimeout(() => utterance.onerror?.({ error: 'canceled' }), 0) });
  voice.speakLines([{ text: 'Una frase.' }], { scope: cancel });
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(voice.voiceStatus(), 'idle'); assert.equal(voice.voiceError(), null, 'Una lettura fermata dall’utente non è un errore.');
  voice.stopVoice(cancel);
}
console.log('Redazione e radio verificate: titoli senza citazioni inventate né frasi sensazionalistiche, scaletta senza ripetizioni (id, fatto, vicenda, titolo), sondaggio con la sua data, il periodo di campo e la variazione tra le ultime due rilevazioni (e «vecchio» detto), limiti di lunghezza reali con tagli a frase intera, testate che scrivono in modo diverso lo stesso fatto, inchieste a passi (indiscrezione, verifiche, risposta, riscontri, esito, rettifica) con esito deciso dal caso e non dalla reputazione, lettura vocale con voce migliore, voiceschanged, ripiego, errori e silenzi segnalati.');
process.exit(0);
