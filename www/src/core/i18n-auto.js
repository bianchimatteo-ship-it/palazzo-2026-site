// Automatic translation, client side: what the phrase book does not know is asked to the server (POST /api/translate, where the provider and its key live: the page never sees a key),
// kept in a persistent cache on the device and reused, so that a text is asked once and works offline afterwards.
//   - Only text of the INTERFACE is sent: never what the player wrote (i18n.js skips those fields), never a text that does not look Italian (names of people, parties and places have no
//     Italian function words), and the names the game knows (registerProperNames) are protected inside the texts that contain them.
//   - Nothing is changed in a career: the translation lives in this cache and in the screen only.
//   - No provider configured, offline, limit reached: the text stays Italian and the state says why (status()), it is never presented as translated.
const KEY = 'politicando.i18n.auto.v1';
const MAX_CACHE = 6000, BATCH = 30, DELAY = 350;
const ITALIAN = /[àèéìòù]|(?:^|[^\p{L}])(?:il|lo|la|le|gli|i|di|del|dello|della|dei|delle|degli|un|una|uno|per|con|che|non|è|sei|sono|hai|ha|ho|in|da|al|alla|alle|ai|nel|nella|nei|nelle|sul|sulla|tra|fra|più|come|dopo|prima|quando|se|ma|anche|ogni|tuo|tua|tuoi|tue|questo|questa|questi|queste)(?=$|[^\p{L}])/iu;

export function looksTranslatable(text, names = []) {
  if (typeof text !== 'string') return false;
  let value = text.trim();
  if (value.length < 4 || value.length > 600) return false;
  if (/^(https?:|www\.|[\w.+-]+@[\w-]+\.)/i.test(value)) return false;
  // what is left once the known names are taken away: a title made only of a name (a party, a person, a place) is not text to translate
  for (const name of [...names].sort((a, b) => b.length - a.length)) if (value.includes(name)) value = value.split(name).join(' ');
  if (!/\p{L}{3}/u.test(value) || !/\p{Ll}/u.test(value)) return false; // nothing but names, numbers, signs or capitals (acronyms, party lists)
  return ITALIAN.test(value);
}

const properNames = new Set();
export function registerProperNames(names) {
  for (const name of names ?? []) if (typeof name === 'string' && name.trim().length >= 3 && name.length <= 80) properNames.add(name.trim());
}
const namesIn = text => [...properNames].filter(name => text.includes(name)).sort((a, b) => b.length - a.length).slice(0, 20);

export function createAutoTranslator({ fetchImpl = (...args) => globalThis.fetch(...args), storage = (() => { try { return globalThis.localStorage; } catch { return null; } })(), endpoint = '/api/translate', base = '', onTranslated = () => {}, names = null, setTimer = setTimeout } = {}) {
  let cache = new Map();
  try { const stored = JSON.parse(storage?.getItem(KEY) ?? '{}'); if (stored && typeof stored === 'object') cache = new Map(Object.entries(stored)); } catch { /* an empty cache */ }
  const pending = new Set(), asked = new Map(); // asked: text → timestamp of the last failed attempt
  let timer = null, inFlight = null;
  let state = { configured: null, reason: null, needs: [], requests: 0, translated: 0, failures: 0 };
  const persist = () => {
    try {
      if (cache.size > MAX_CACHE) cache = new Map([...cache].slice(-MAX_CACHE));
      storage?.setItem(KEY, JSON.stringify(Object.fromEntries(cache)));
    } catch { /* storage full or blocked: the cache of this session still works */ }
  };
  async function flush() {
    timer = null;
    if (inFlight) { await inFlight; }
    const texts = [...pending].slice(0, BATCH);
    for (const text of texts) pending.delete(text);
    if (!texts.length) return state;
    try { registerProperNames(names?.()); } catch { /* the names are a protection, not a requirement */ }
    const keep = [...new Set(texts.flatMap(namesIn))];
    inFlight = (async () => {
      try {
        const response = await fetchImpl(`${base}${endpoint}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texts, keep }) });
        state.requests++;
        const data = await response.json().catch(() => ({}));
        if (response.status === 503 || data.configured === false) { state = { ...state, configured: false, reason: 'Traduzione automatica non configurata sul server: i testi nuovi restano in italiano.', needs: data.needs ?? [] }; texts.forEach(text => asked.set(text, Infinity)); return; }
        if (!response.ok) { state = { ...state, configured: data.configured ?? state.configured, reason: data.error ?? `Errore ${response.status}`, failures: state.failures + 1 }; texts.forEach(text => asked.set(text, Date.now())); return; }
        state = { ...state, configured: true, reason: null, needs: [] };
        let added = 0;
        for (const text of texts) {
          const english = data.translations?.[text];
          if (typeof english === 'string' && english) { cache.set(text, english); added++; } else asked.set(text, Date.now());
        }
        if (added) { state.translated += added; persist(); onTranslated(added); }
      } catch (error) {
        state = { ...state, reason: 'Rete non disponibile: userò le traduzioni già salvate sul dispositivo.', failures: state.failures + 1 };
        texts.forEach(text => asked.set(text, Date.now()));
      }
    })();
    await inFlight; inFlight = null;
    if (pending.size) timer = setTimer(flush, DELAY);
    return state;
  }
  return {
    lookup: text => cache.get(text),
    // Asks for a text unless it is known, already queued, refused for good (no provider) or failed in the last minute.
    request(text) {
      if (cache.has(text) || pending.has(text)) return;
      try { registerProperNames(names?.()); } catch { /* optional */ }
      if (!looksTranslatable(text, [...properNames])) return;
      const last = asked.get(text);
      if (last === Infinity || (last && Date.now() - last < 60000)) return;
      pending.add(text);
      if (!timer) timer = setTimer(flush, DELAY);
    },
    flush: async () => { if (timer) { clearTimeout(timer); timer = null; } while (pending.size || inFlight) { await flush(); if (!pending.size) break; } return state; },
    status: () => ({ ...state, cached: cache.size, pending: pending.size }),
    // The state of the service on the server (does not translate anything).
    async probe() {
      try { const data = await (await fetchImpl(`${base}${endpoint}/status`)).json(); state = { ...state, configured: Boolean(data.configured), needs: data.needs ?? [], reason: data.configured ? null : 'Traduzione automatica non configurata sul server.' }; } catch { state = { ...state, reason: 'Rete non disponibile.' }; }
      return state;
    },
    size: () => cache.size,
    pairs: () => [...cache]
  };
}
