// Automatic translation IT → EN, server side. Used by worker.js (POST /api/translate) and by scripts/i18n-auto.mjs (build time): the same protection, glossary and checks.
//
// What it does NOT do: it does not translate by itself. A real provider is needed and is chosen by configuration, never in the page:
//   TRANSLATE_PROVIDER = deepl | google | libretranslate        (variable of the Worker)
//   TRANSLATE_API_KEY  = the key of the provider                (Worker SECRET: npx wrangler secret put TRANSLATE_API_KEY; never in the repository, never sent to the page)
//   TRANSLATE_API_URL  = base URL, only for libretranslate (a server of your own is free; public instances usually want a key)
//   TRANSLATE_DAILY_CHARS (optional) = ceiling of NEW characters sent to the provider per day (default 200000), to bound the cost; cached texts cost nothing.
// Without them every function reports `configured: false` and says what is missing: nothing is invented and the phrase book is not passed off as machine translation.
//
// Protected from the provider (kept verbatim, in the English text too): placeholders ({name}, {}, %s, #), numbers (the page formats them), the names given in `keep`
// (people, parties, places) and the political/institutional glossary below, whose English term is fixed.

const SPAN = 'translate="no" class="notranslate"';
const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unescapeHtml = text => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'").replace(/&#x27;/gi, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

// Institutional terms: the Italian form (several inflections) and the English term that is always used. Longest first when matched.
export const GLOSSARY = [
  ['Camera dei deputati', 'Chamber of Deputies'], ['Camera dei Deputati', 'Chamber of Deputies'], ['Senato della Repubblica', 'Senate of the Republic'], ['Presidente della Repubblica', 'President of the Republic'],
  ['Presidente del Consiglio', 'Prime Minister'], ['Consiglio dei ministri', 'Council of Ministers'], ['Consiglio dei Ministri', 'Council of Ministers'], ['Parlamento europeo', 'European Parliament'],
  ['Corte costituzionale', 'Constitutional Court'], ['Corte di cassazione', 'Court of Cassation'], ['Consiglio superiore della magistratura', 'High Council of the Judiciary'],
  ['consiglio comunale', 'city council'], ['consiglio provinciale', 'provincial council'], ['consiglio regionale', 'regional council'], ['consigliere comunale', 'city councillor'], ['consigliera comunale', 'city councillor'],
  ['consiglieri comunali', 'city councillors'], ['consigliere provinciale', 'provincial councillor'], ['consigliere regionale', 'regional councillor'], ['consiglieri regionali', 'regional councillors'],
  ['giunta comunale', 'city executive'], ['giunta regionale', 'regional executive'], ['assessore comunale', 'city executive member'], ['assessore regionale', 'regional executive member'],
  ['sindaco', 'mayor'], ['sindaci', 'mayors'], ['presidente della Regione', 'Regional President'], ['presidente della Provincia', 'Provincial President'], ['Presidente della Provincia', 'Provincial President'],
  ['ballottaggio', 'runoff'], ['ballottaggi', 'runoffs'], ['collegio uninominale', 'single-member constituency'], ['collegi uninominali', 'single-member constituencies'], ['quota proporzionale', 'proportional share'],
  ['legge elettorale', 'electoral law'], ['soglia di sbarramento', 'electoral threshold'], ['premio di maggioranza', 'majority bonus'], ['capolista', 'list leader'], ['capolista', 'list leader'],
  ['elezioni politiche', 'general election'], ['elezioni europee', 'European election'], ['elezioni regionali', 'regional election'], ['elezioni provinciali', 'provincial election'], ['elezioni comunali', 'municipal election'],
  ['gruppo parlamentare', 'parliamentary group'], ['gruppi parlamentari', 'parliamentary groups'], ['maggioranza', 'majority'], ['opposizione', 'opposition'], ['coalizione', 'coalition'], ['coalizioni', 'coalitions'],
  ['centrodestra', 'centre-right'], ['centrosinistra', 'centre-left'], ['sondaggio', 'poll'], ['sondaggi', 'polls'], ['consenso', 'support'], ['comitato', 'committee'], ['comitati', 'committees'],
  ['segretario di partito', 'party leader'], ['segretario', 'party leader'], ['legislatura', 'legislature'], ['mozione di sfiducia', 'no-confidence motion'], ['voto di fiducia', 'confidence vote'],
  ['decreto-legge', 'decree-law'], ['disegno di legge', 'bill'], ['Gazzetta Ufficiale', 'Official Gazette'], ['Quirinale', 'Quirinale'], ['Palazzo Chigi', 'Palazzo Chigi']
].sort((a, b) => b[0].length - a[0].length);

function capitalised(from, to) { return /^[A-ZÀ-Ý]/.test(from) ? to.charAt(0).toUpperCase() + to.slice(1) : to; }
const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const GLOSSARY_RE = new RegExp(`(?<![\\p{L}\\p{N}])(${GLOSSARY.map(([it]) => escapeRegex(it)).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
const GLOSSARY_MAP = new Map(GLOSSARY.map(([it, en]) => [it.toLowerCase(), en]));
// Capitalised common nouns of the institutions: they are words to translate, not names.
const COMMON_CAPITALS = new Set(['Stato', 'Governo', 'Camera', 'Senato', 'Parlamento', 'Repubblica', 'Regione', 'Comune', 'Provincia', 'Presidente', 'Ministro', 'Costituzione', 'Europa', 'Unione', 'Consiglio', 'Commissione', 'Corte', 'Legge', 'Decreto']);
const PLACEHOLDER_RE = /\{[^{}]{0,40}\}|%[sd]|#|\d[\d.,]*/g;

// The text as the provider will see it: the escaped text where every protected stretch is wrapped in a span the provider must leave alone. Returns the HTML and the exact list of protected stretches.
export function protect(text, keep = []) {
  const names = [...new Set((keep ?? []).filter(item => typeof item === 'string' && item.length >= 2))].sort((a, b) => b.length - a.length).slice(0, 30);
  const pieces = [];
  let rest = String(text);
  const mark = (value, shown = value) => { pieces.push(shown); return String.fromCharCode(0xE000 + pieces.length - 1); };
  for (const name of names) rest = rest.split(name).join(mark(name));
  rest = rest.replace(GLOSSARY_RE, match => { const en = GLOSSARY_MAP.get(match.toLowerCase()); return en ? mark(match, capitalised(match, en)) : match; });
  // Proper nouns that nobody listed: a run of capitalised words in the middle of a sentence (Forza Italia, Berlusconi) or an acronym (PPE, M5S) is kept as it is.
  rest = rest.replace(/(?<=[\p{Ll}\p{N},;:)\-–—·] )((?:[\p{Lu}][\p{L}'’.-]*|\p{Lu}[\p{Lu}\p{N}]+)(?: (?:[\p{Lu}][\p{L}'’.-]*|d[’']\p{Lu}[\p{L}]*))*)/gu, run => COMMON_CAPITALS.has(run) ? run : mark(run));
  rest = rest.replace(/(?<![\p{L}\p{N}\uE000-\uF8FF])\p{Lu}[\p{Lu}\p{N}]{1,7}(?![\p{L}\p{N}])/gu, run => mark(run));
  rest = rest.replace(PLACEHOLDER_RE, match => mark(match));
  const html = escapeHtml(rest).replace(/[\uE000-\uF8FF]/g, mark => `<span ${SPAN}>${escapeHtml(pieces[mark.charCodeAt(0) - 0xE000])}</span>`);
  return { html, pieces };
}
// The provider's answer back to plain text; null when a protected stretch was lost, altered or duplicated (the caller keeps the Italian then: never a wrong text).
export function restore(answer, pieces) {
  if (typeof answer !== 'string') return null;
  const seen = [];
  const plain = answer.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, (m, inner) => { seen.push(unescapeHtml(inner)); return inner; });
  if (/<[a-z/][^>]*>/i.test(plain)) return null;
  const text = unescapeHtml(plain).replace(/\s+/g, ' ').trim();
  if (!text || seen.length !== pieces.length) return null;
  const left = [...pieces];
  for (const item of seen) { const at = left.indexOf(item); if (at < 0) return null; left.splice(at, 1); }
  return text;
}

export const providerOf = env => {
  const provider = String(env?.TRANSLATE_PROVIDER ?? '').toLowerCase();
  if (!['deepl', 'google', 'libretranslate'].includes(provider)) return null;
  if (provider === 'libretranslate' ? !env.TRANSLATE_API_URL : !env.TRANSLATE_API_KEY) return null;
  return provider;
};
// What is missing, in words, for the owner.
export function needsOf(env) {
  const needs = [];
  const provider = String(env?.TRANSLATE_PROVIDER ?? '').toLowerCase();
  if (!['deepl', 'google', 'libretranslate'].includes(provider)) needs.push('TRANSLATE_PROVIDER (variabile): deepl, google oppure libretranslate');
  if (provider === 'libretranslate') { if (!env?.TRANSLATE_API_URL) needs.push('TRANSLATE_API_URL (variabile): indirizzo del server LibreTranslate'); }
  else if (!env?.TRANSLATE_API_KEY) needs.push('TRANSLATE_API_KEY (secret del Worker): chiave del provider scelto');
  return needs;
}

// One call to the provider for a list of HTML texts → a list of answers (strings or null). `fetchImpl` is injectable for tests.
export async function callProvider(provider, env, htmlTexts, fetchImpl = fetch) {
  const timeout = AbortSignal.timeout?.(Number(env.TRANSLATE_TIMEOUT_MS) || 15000);
  if (provider === 'deepl') {
    const base = String(env.TRANSLATE_API_KEY).endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
    const response = await fetchImpl(`${base}/v2/translate`, { method: 'POST', signal: timeout, headers: { 'content-type': 'application/json', authorization: `DeepL-Auth-Key ${env.TRANSLATE_API_KEY}` }, body: JSON.stringify({ text: htmlTexts, source_lang: 'IT', target_lang: 'EN-GB', tag_handling: 'html', preserve_formatting: true }) });
    if (!response.ok) throw new Error(`deepl ${response.status}`);
    return (await response.json()).translations.map(item => item.text);
  }
  if (provider === 'google') {
    const response = await fetchImpl(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(env.TRANSLATE_API_KEY)}`, { method: 'POST', signal: timeout, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: htmlTexts, source: 'it', target: 'en', format: 'html' }) });
    if (!response.ok) throw new Error(`google ${response.status}`);
    return (await response.json()).data.translations.map(item => item.translatedText);
  }
  const base = String(env.TRANSLATE_API_URL).replace(/\/+$/, '');
  const response = await fetchImpl(`${base}/translate`, { method: 'POST', signal: timeout, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: htmlTexts, source: 'it', target: 'en', format: 'html', ...(env.TRANSLATE_API_KEY ? { api_key: env.TRANSLATE_API_KEY } : {}) }) });
  if (!response.ok) throw new Error(`libretranslate ${response.status}`);
  const data = await response.json();
  return Array.isArray(data.translatedText) ? data.translatedText : [data.translatedText];
}

// Translates a batch: { texts, keep } → { translations: { italian: english | null }, sent } (sent = characters that went to the provider). Texts already known are given by `known` (a function).
export async function translateBatch(env, texts, keep = [], { fetchImpl = fetch, known = async () => null, remember = async () => {} } = {}) {
  const provider = providerOf(env);
  const translations = {};
  let sent = 0;
  const todo = [];
  for (const text of texts) {
    const hit = await known(text, keep);
    if (typeof hit === 'string') translations[text] = hit; else todo.push(text);
  }
  if (!todo.length) return { translations, sent };
  if (!provider) { for (const text of todo) translations[text] = null; return { translations, sent, configured: false }; }
  const prepared = todo.map(text => ({ text, ...protect(text, keep.filter(name => text.includes(name))) }));
  const answers = await callProvider(provider, env, prepared.map(item => item.html), fetchImpl);
  sent = prepared.reduce((sum, item) => sum + item.html.length, 0);
  for (let i = 0; i < prepared.length; i++) {
    const english = restore(answers[i], prepared[i].pieces);
    translations[prepared[i].text] = english && english !== prepared[i].text ? english : null;
    if (translations[prepared[i].text]) await remember(prepared[i].text, keep, translations[prepared[i].text]);
  }
  return { translations, sent };
}

// ---- the Worker side: validation, persistent cache, rate limit and daily ceiling ----
const MAX_TEXTS = 40, MAX_LENGTH = 600;
const hex = buffer => [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
async function keyOf(provider, text, keep) { return `tr:v1:${provider}:${hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${text}\u0000${[...keep].sort().join('\u0001')}`))).slice(0, 40)}`; }

export async function handleTranslate(request, env, json, url) {
  const store = env.TRANSLATION_CACHE ?? env.ADMIN_ARCHIVE;
  const needs = needsOf(env);
  if (url.pathname === '/api/translate/status' && request.method === 'GET') return json(request, { ok: true, configured: needs.length === 0, provider: needs.length === 0 ? providerOf(env) : null, needs, cache: Boolean(store) });
  if (url.pathname !== '/api/translate' || request.method !== 'POST') return json(request, { error: 'Richiesta non riconosciuta.' }, 404);
  if (needs.length) return json(request, { ok: false, configured: false, error: 'Traduzione automatica non configurata: i testi restano in italiano.', needs }, 503);
  let body;
  try { body = await request.json(); } catch { return json(request, { error: 'Richiesta non valida.' }, 400); }
  const texts = [...new Set(Array.isArray(body?.texts) ? body.texts : [])].filter(item => typeof item === 'string');
  if (!texts.length || texts.length > MAX_TEXTS || texts.some(item => item.length < 2 || item.length > MAX_LENGTH || !/\p{L}{2}/u.test(item))) return json(request, { error: `Servono da 1 a ${MAX_TEXTS} testi di al più ${MAX_LENGTH} caratteri.` }, 400);
  const keep = (Array.isArray(body.keep) ? body.keep : []).filter(item => typeof item === 'string' && item.length <= 80).slice(0, 60);
  const provider = providerOf(env);
  const known = async (text) => store ? await store.get(await keyOf(provider, text, keep.filter(name => text.includes(name)))) : null;
  const remember = async (text, names, english) => { if (store) await store.put(await keyOf(provider, text, names.filter(name => text.includes(name))), english); };
  // only what is NOT cached is limited: the ceiling of the day and the requests of an address in a minute
  const unknown = [];
  for (const text of texts) if (typeof await known(text) !== 'string') unknown.push(text);
  if (unknown.length && store) {
    const day = new Date().toISOString().slice(0, 10), ip = request.headers.get('cf-connecting-ip') ?? 'locale', minute = Math.floor(Date.now() / 60000);
    const rateKey = `trr:${ip}:${minute}`, dayKey = `trq:${day}`;
    const rate = Number(await store.get(rateKey) ?? 0), used = Number(await store.get(dayKey) ?? 0);
    const ceiling = Number(env.TRANSLATE_DAILY_CHARS) || 200000;
    if (rate >= 20) return json(request, { error: 'Troppe richieste di traduzione: riprova tra poco.' }, 429);
    const cost = unknown.reduce((sum, item) => sum + item.length, 0);
    if (used + cost > ceiling) return json(request, { ok: false, configured: true, error: 'Limite giornaliero della traduzione automatica raggiunto: i testi nuovi restano in italiano fino a domani.', limit: true }, 429);
    await store.put(rateKey, String(rate + 1), { expirationTtl: 120 });
    await store.put(dayKey, String(used + cost), { expirationTtl: 172800 });
  }
  try {
    const { translations } = await translateBatch(env, texts, keep, { known, remember });
    return json(request, { ok: true, configured: true, provider, translations });
  } catch (error) {
    return json(request, { ok: false, configured: true, error: 'Il provider di traduzione non ha risposto: i testi restano in italiano.' }, 502);
  }
}
