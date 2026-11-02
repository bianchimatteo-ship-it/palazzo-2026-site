// Automatic translation, client side. The interface text that the phrase book does not know is turned into an anonymous TEMPLATE (names, numbers and variables replaced by ⟦0⟧, ⟦1⟧…), the template is asked
// to the Worker (POST /api/translate, where the DeepL key lives: the page never sees it), the English template is kept in a persistent cache on the device and the values are put back HERE, locally.
//   - What leaves the device is a template with no name, number, date value, variable or anything of a career in it: «Hai ottenuto ⟦0⟧ voti a ⟦1⟧» is asked, «Hai ottenuto 1.200 voti a Siena» is not.
//   - Never asked: what the players wrote (i18n.js skips those fields), texts that are only names/numbers/capitals, texts that do not look Italian.
//   - Asked at most once: the cache is looked up first, a template that is already waiting or failed recently is not asked again, requests are batched and spaced, and after a refusal of the server
//     (limit reached, not configured, rate) the page stops asking for a while.
//   - Offline, unavailable or over the limit: the Italian text stays (and the state says why: status()).
const KEY = 'politicando.i18n.auto.v2', OLD_KEY = 'politicando.i18n.auto.v1';
const MAX_CACHE = 4000, BATCH = 20, CHARS_PER_REQUEST = 1500, DELAY = 600, SPACING = 1500, PAUSE = 30 * 60000;
const ITALIAN = /[àèéìòù]|(?:^|[^\p{L}])(?:il|lo|la|le|gli|i|di|del|dello|della|dei|delle|degli|un|una|uno|per|con|che|non|è|sei|sono|hai|ha|ho|in|da|al|alla|alle|ai|nel|nella|nei|nelle|sul|sulla|tra|fra|più|come|dopo|prima|quando|se|ma|anche|ogni|tuo|tua|tuoi|tue|questo|questa|questi|queste)(?=$|[^\p{L}])/iu;
const CALENDAR = new Set(['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre', 'gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica', 'di', 'del', 'alle', 'ore']);
const TOKEN = /⟦(\d{1,2})⟧/g;
const MARK0 = 0xE000;

const properNames = new Set();
export function registerProperNames(names) {
  for (const name of names ?? []) if (typeof name === 'string' && name.trim().length >= 3 && name.length <= 80) properNames.add(name.trim());
}

// Text → { template, values }. Order: names the game knows, runs of capitalised words (names of people, parties, places), acronyms, variables ({name}, %s), numbers and dates.
export function maskText(text, names = []) {
  const values = [];
  const mark = value => { values.push(value); return String.fromCharCode(MARK0 + values.length - 1); };
  let rest = String(text);
  for (const name of [...names].filter(item => item && item.length >= 3).sort((a, b) => b.length - a.length)) if (rest.includes(name)) rest = rest.split(name).join(mark(name));
  // a capitalised word in the middle of a sentence is a name; at the start, two or more capitalised words together are a name (a single one is the sentence case)
  rest = rest.replace(/(?<=[\p{Ll},;:)\-–—·] )(\p{Lu}[\p{L}'’.-]*(?: (?:\p{Lu}[\p{L}'’.-]*|d[’']\p{Lu}[\p{L}]*))*)/gu, run => /^(Stato|Governo|Camera|Senato|Parlamento|Repubblica|Regione|Comune|Provincia|Presidente|Ministro|Costituzione|Europa|Unione|Consiglio|Commissione|Corte|Legge|Decreto)$/.test(run) ? run : mark(run));
  rest = rest.replace(/^(\p{Lu}[\p{L}'’.-]*(?: (?:\p{Lu}[\p{L}'’.-]*|d[’']\p{Lu}[\p{L}]*))+)/u, run => mark(run));
  rest = rest.replace(/(?<![\p{L}\p{N}-])\p{Lu}{2,8}\d*(?![\p{L}\p{N}])/gu, run => mark(run));
  rest = rest.replace(/\{[^{}]{0,40}\}|%[sd]|#/g, run => mark(run));
  rest = rest.replace(/\d[\d.,:/]*\d|\d/g, run => mark(run));
  const template = rest.replace(/[-]/g, char => `⟦${char.charCodeAt(0) - MARK0}⟧`);
  return { template, values };
}
// English template + values → text; null when a token is missing, repeated or unknown (the answer is not used).
export function fillTemplate(english, values) {
  const seen = new Set();
  let bad = false;
  const out = String(english).replace(TOKEN, (m, index) => {
    const i = Number(index);
    if (i >= values.length || seen.has(i)) { bad = true; return m; }
    seen.add(i);
    return values[i];
  });
  return bad || seen.size !== values.length ? null : out;
}
// A template is worth asking when its Italian wording (without the tokens) is real text: lowercase words, Italian function words.
export function looksTranslatable(template) {
  if (typeof template !== 'string' || template.length < 4 || template.length > 400) return false;
  const bare = template.replace(TOKEN, ' ').trim();
  if (/\d|@|:\/\/|www\./i.test(bare)) return false;
  if (!/\p{L}{3}/u.test(bare) || !/\p{Ll}/u.test(bare)) return false;
  // dates and weekdays are written in English by the page itself (i18n.js): nothing to ask
  if (bare.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean).every(word => CALENDAR.has(word.toLowerCase()))) return false;
  return ITALIAN.test(bare);
}

export function createAutoTranslator({ fetchImpl = (...args) => globalThis.fetch(...args), storage = (() => { try { return globalThis.localStorage; } catch { return null; } })(), endpoint = '/api/translate', base = '', onTranslated = () => {}, names = null, now = () => Date.now(), setTimer = setTimeout } = {}) {
  let cache = new Map();
  try { storage?.removeItem?.(OLD_KEY); const stored = JSON.parse(storage?.getItem(KEY) ?? '{}'); if (stored && typeof stored === 'object') cache = new Map(Object.entries(stored)); } catch { /* an empty cache */ }
  const pending = new Set(), asked = new Map(); // asked: template → time of the last failed attempt (Infinity: never again in this session)
  let timer = null, running = false, lastFlush = 0, pausedUntil = 0;
  let state = { configured: null, reason: null, needs: [], requests: 0, translated: 0, failures: 0, paused: false };
  const persist = () => {
    try {
      if (cache.size > MAX_CACHE) cache = new Map([...cache].slice(-MAX_CACHE));
      storage?.setItem(KEY, JSON.stringify(Object.fromEntries(cache)));
    } catch { /* storage full or blocked: the cache of this session still works */ }
  };
  const known = () => { try { registerProperNames(names?.()); } catch { /* optional */ } return [...properNames]; };
  const schedule = () => { if (!timer && pending.size) timer = setTimer(flushOnce, Math.max(DELAY, SPACING - (now() - lastFlush))); };
  async function flushOnce() {
    timer = null;
    if (running || !pending.size) return;
    if (now() < pausedUntil) { state.paused = true; return; }
    state.paused = false;
    const templates = [];
    let chars = 0;
    for (const template of pending) { if (templates.length >= BATCH || chars + template.length > CHARS_PER_REQUEST) break; templates.push(template); chars += template.length; }
    for (const template of templates) pending.delete(template);
    if (!templates.length) return;
    running = true; lastFlush = now();
    try {
      const response = await fetchImpl(`${base}${endpoint}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texts: templates }) });
      state.requests++;
      const data = await response.json().catch(() => ({}));
      if (response.status === 503 && data.configured === false) { state = { ...state, configured: false, reason: 'Traduzione automatica non configurata sul server: i testi nuovi restano in italiano.', needs: data.needs ?? [] }; for (const t of templates) asked.set(t, Infinity); pending.clear(); return; }
      if (response.status === 429 || response.status === 503) { pausedUntil = now() + PAUSE; state = { ...state, configured: data.configured ?? state.configured, reason: data.limit ? 'Limite di traduzione automatica raggiunto: i testi nuovi restano in italiano.' : (data.error ?? 'Servizio non disponibile'), paused: true, failures: state.failures + 1 }; for (const t of templates) asked.set(t, now()); pending.clear(); return; }
      if (!response.ok) { state = { ...state, reason: data.error ?? `Errore ${response.status}`, failures: state.failures + 1 }; for (const t of templates) asked.set(t, now()); return; }
      state = { ...state, configured: true, reason: null, needs: [] };
      let added = 0;
      for (const template of templates) {
        const english = data.translations?.[template];
        // the answer must carry exactly the tokens of the template: otherwise it is not used
        if (typeof english === 'string' && english && fillTemplate(english, Array.from({ length: (template.match(TOKEN) ?? []).length }, (_, i) => `⟦${i}⟧`)) !== null) { cache.set(template, english); added++; } else asked.set(template, now());
      }
      if (added) { state.translated += added; persist(); onTranslated(added); }
    } catch {
      state = { ...state, reason: 'Rete non disponibile: userò le traduzioni già salvate sul dispositivo.', failures: state.failures + 1 };
      for (const t of templates) asked.set(t, now());
    } finally { running = false; schedule(); }
  }
  return {
    // The English of a text if its template is in the cache (values put back here), else undefined.
    lookup(text) {
      const { template, values } = maskText(text, known());
      const english = cache.get(template);
      return english === undefined ? undefined : fillTemplate(english, values) ?? undefined;
    },
    // Asks for the template of a text unless it is known, already waiting, refused for good or failed in the last minute.
    request(text) {
      if (typeof text !== 'string') return;
      const { template } = maskText(text, known());
      if (cache.has(template) || pending.has(template) || !looksTranslatable(template)) return;
      const last = asked.get(template);
      if (last === Infinity || (last && now() - last < 60000)) return;
      pending.add(template);
      schedule();
    },
    flush: async () => { if (timer) { clearTimeout(timer); timer = null; } while (pending.size && now() >= pausedUntil) { const before = pending.size; await flushOnce(); if (pending.size >= before) break; } return state; },
    status: () => ({ ...state, cached: cache.size, pending: pending.size }),
    // The state of the service on the server (does not translate anything and costs nothing).
    async probe() {
      try { const data = await (await fetchImpl(`${base}${endpoint}/status`)).json(); state = { ...state, configured: Boolean(data.configured), needs: data.needs ?? [], reason: data.configured ? null : 'Traduzione automatica non configurata sul server.' }; } catch { state = { ...state, reason: 'Rete non disponibile.' }; }
      return state;
    },
    size: () => cache.size,
    pairs: () => [...cache]
  };
}
