// Automatic translation IT → EN with DeepL API, server side only (POST /api/translate on the Worker).
//
// Configuration (Worker): TRANSLATE_PROVIDER=deepl (variable) and TRANSLATE_API_KEY (SECRET: never in the repository, never sent to the page, never logged).
//   Endpoint: a key ending in ":fx" is a DeepL API Free key (https://api-free.deepl.com); any other key is a paid-plan key (Developer/Pro, https://api.deepl.com). That is DeepL's own rule for the two hosts.
//   Limits (variables, defaults in brackets): TRANSLATE_DAILY_CHARS [10000], TRANSLATE_MONTHLY_CHARS [100000], TRANSLATE_REQUEST_CHARS [2000] per request, TRANSLATE_MAX_TEXTS [20] per request,
//   TRANSLATE_RATE_PER_MIN [20] requests per address per minute. TRANSLATE_PROVIDER unset or any other value: the service is off and says so; no other provider is ever called.
//
// What is sent to DeepL: anonymous TEMPLATES only. The page replaces names, numbers and variables with placeholders (⟦0⟧, ⟦1⟧…) before it asks the Worker; the Worker replaces whatever is
// left (political glossary, capitalised names, acronyms) with anonymous `<x i="k"/>` tags and keeps the values here; DeepL receives the tags and the Italian words around them, never a
// value. The answer is put back locally. Texts written by the players, accounts, saves and anything of a career never reach this module (the page does not send them and the Worker refuses
// a template that still holds a digit, an e-mail address or an address of a site).
//
// What is spent: the characters of the payload really sent (tags included) are RESERVED before the call, in one atomic statement on D1 (the database of the Worker), against a daily and a monthly
// ceiling shared by every user. A reservation is never given back, not even when the call fails. When D1 does not answer, nothing is sent (fail closed). When DeepL answers with a quota or
// authorisation error the service blocks itself for hours: no repeated attempts. What was already translated comes from the KV cache and costs nothing.

const SPAN_CLOSED = '<x i="';
const escapeXml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unescapeXml = text => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'").replace(/&amp;/g, '&');

// Institutional terms: Italian form and the English term that is always used (put in by the Worker, so DeepL does not see them).
export const GLOSSARY = [
  ['Camera dei deputati', 'Chamber of Deputies'], ['Camera dei Deputati', 'Chamber of Deputies'], ['Senato della Repubblica', 'Senate of the Republic'], ['Presidente della Repubblica', 'President of the Republic'],
  ['Presidente del Consiglio', 'Prime Minister'], ['Consiglio dei ministri', 'Council of Ministers'], ['Consiglio dei Ministri', 'Council of Ministers'], ['Parlamento europeo', 'European Parliament'],
  ['Corte costituzionale', 'Constitutional Court'], ['Corte di cassazione', 'Court of Cassation'], ['Consiglio superiore della magistratura', 'High Council of the Judiciary'],
  ['consiglio comunale', 'city council'], ['consiglio provinciale', 'provincial council'], ['consiglio regionale', 'regional council'], ['consigliere comunale', 'city councillor'], ['consigliera comunale', 'city councillor'],
  ['consiglieri comunali', 'city councillors'], ['consigliere provinciale', 'provincial councillor'], ['consigliere regionale', 'regional councillor'], ['consiglieri regionali', 'regional councillors'],
  ['giunta comunale', 'city executive'], ['giunta regionale', 'regional executive'], ['assessore comunale', 'city executive member'], ['assessore regionale', 'regional executive member'],
  ['sindaco', 'mayor'], ['sindaci', 'mayors'], ['presidente della Regione', 'Regional President'], ['presidente della Provincia', 'Provincial President'], ['Presidente della Provincia', 'Provincial President'],
  ['ballottaggio', 'runoff'], ['ballottaggi', 'runoffs'], ['collegio uninominale', 'single-member constituency'], ['collegi uninominali', 'single-member constituencies'], ['quota proporzionale', 'proportional share'],
  ['legge elettorale', 'electoral law'], ['soglia di sbarramento', 'electoral threshold'], ['premio di maggioranza', 'majority bonus'], ['capolista', 'list leader'],
  ['elezioni politiche', 'general election'], ['elezioni europee', 'European election'], ['elezioni regionali', 'regional election'], ['elezioni provinciali', 'provincial election'], ['elezioni comunali', 'municipal election'],
  ['gruppo parlamentare', 'parliamentary group'], ['gruppi parlamentari', 'parliamentary groups'], ['maggioranza', 'majority'], ['opposizione', 'opposition'], ['coalizione', 'coalition'], ['coalizioni', 'coalitions'],
  ['centrodestra', 'centre-right'], ['centrosinistra', 'centre-left'], ['sondaggio', 'poll'], ['sondaggi', 'polls'], ['consenso', 'support'], ['comitato', 'committee'], ['comitati', 'committees'],
  ['segretario di partito', 'party leader'], ['legislatura', 'legislature'], ['mozione di sfiducia', 'no-confidence motion'], ['voto di fiducia', 'confidence vote'],
  ['decreto-legge', 'decree-law'], ['disegno di legge', 'bill'], ['Gazzetta Ufficiale', 'Official Gazette']
].sort((a, b) => b[0].length - a[0].length);
const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const GLOSSARY_RE = new RegExp(`(?<![\\p{L}\\p{N}])(${GLOSSARY.map(([it]) => escapeRegex(it)).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
const GLOSSARY_MAP = new Map(GLOSSARY.map(([it, en]) => [it.toLowerCase(), en]));
const capitalised = (from, to) => /^[A-ZÀ-Ý]/.test(from) ? to.charAt(0).toUpperCase() + to.slice(1) : to;
// Capitalised common nouns of the institutions are words to translate, not names.
const COMMON_CAPITALS = new Set(['Stato', 'Governo', 'Camera', 'Senato', 'Parlamento', 'Repubblica', 'Regione', 'Comune', 'Provincia', 'Presidente', 'Ministro', 'Costituzione', 'Europa', 'Unione', 'Consiglio', 'Commissione', 'Corte', 'Legge', 'Decreto']);
// The tokens the page puts in place of a name, a number or a variable.
const TOKEN_RE = /⟦\d{1,2}⟧/g;
const MARK_FIRST = 0xE000;

// A template is sendable when nothing of a person or a career can be left in it.
export function sendable(template) {
  if (typeof template !== 'string' || template.length < 4 || template.length > 400) return false;
  const bare = template.replace(TOKEN_RE, ' ');
  if (/\d|@|:\/\/|www\./i.test(bare)) return false; // numbers, addresses and e-mail are the page's to mask
  return /\p{L}{3}/u.test(bare) && /\p{Ll}/u.test(bare);
}

// The payload for DeepL and the values to put back. Everything that is not plain Italian wording becomes an anonymous <x i="k"/> tag.
export function anonymize(template) {
  const values = [];
  const mark = (shown) => { values.push(shown); return String.fromCharCode(MARK_FIRST + values.length - 1); };
  let rest = String(template);
  rest = rest.replace(TOKEN_RE, token => mark(token));
  rest = rest.replace(GLOSSARY_RE, match => { const en = GLOSSARY_MAP.get(match.toLowerCase()); return en ? mark(capitalised(match, en)) : match; });
  // a run of capitalised words in the middle of a sentence, or an acronym, is a name even if the page did not know it: it stays here
  rest = rest.replace(/(?<=[\p{Ll},;:)\-–—·] )((?:\p{Lu}[\p{L}'’.-]*)(?: (?:\p{Lu}[\p{L}'’.-]*|d[’']\p{Lu}[\p{L}]*))*)/gu, run => COMMON_CAPITALS.has(run) ? run : mark(run));
  rest = rest.replace(/(?<![\p{L}\p{N}-])\p{Lu}[\p{Lu}]{1,7}(?![\p{L}\p{N}])/gu, run => mark(run));
  const payload = escapeXml(rest).replace(/[-]/g, char => `${SPAN_CLOSED}${char.charCodeAt(0) - MARK_FIRST}"/>`);
  return { payload, values };
}
// DeepL's answer with the values put back; null when a tag was lost, repeated or altered (the Italian stays, the answer is not used and not cached).
export function restore(answer, values) {
  if (typeof answer !== 'string') return null;
  const seen = new Set();
  let broken = false;
  const text = answer.replace(/<x\s+i="(\d+)"\s*\/>|<x\s+i="(\d+)"\s*>\s*<\/x>/g, (m, a, b) => {
    const index = Number(a ?? b);
    if (index >= values.length || seen.has(index)) { broken = true; return ''; }
    seen.add(index);
    return values[index];
  });
  if (broken || seen.size !== values.length || /<\/?[a-z][^>]*>/i.test(text)) return null;
  const out = unescapeXml(text).replace(/\s+/g, ' ').trim();
  return out || null;
}

// ---- configuration ----
const number = (value, fallback) => { const n = Number(value); return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback; };
export const limitsOf = env => ({
  day: number(env?.TRANSLATE_DAILY_CHARS, 10000), month: number(env?.TRANSLATE_MONTHLY_CHARS, 100000),
  request: number(env?.TRANSLATE_REQUEST_CHARS, 2000), texts: number(env?.TRANSLATE_MAX_TEXTS, 20), rate: number(env?.TRANSLATE_RATE_PER_MIN, 20)
});
export const providerOf = env => String(env?.TRANSLATE_PROVIDER ?? '').toLowerCase() === 'deepl' && env?.TRANSLATE_API_KEY ? 'deepl' : null;
export function needsOf(env) {
  const needs = [];
  if (String(env?.TRANSLATE_PROVIDER ?? '').toLowerCase() !== 'deepl') needs.push('TRANSLATE_PROVIDER (variabile del Worker): deve valere «deepl»');
  if (!env?.TRANSLATE_API_KEY) needs.push('TRANSLATE_API_KEY (secret del Worker): chiave DeepL');
  if (!env?.ACCOUNTS) needs.push('database D1 «ACCOUNTS» (contatore dei consumi)');
  if (!(env?.TRANSLATION_CACHE ?? env?.ADMIN_ARCHIVE)) needs.push('archivio KV della cache');
  return needs;
}
export const deeplHost = key => String(key).endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';

// One call to DeepL for a list of payloads. Never retried here.
export async function callDeepL(env, payloads, fetchImpl = fetch) {
  const response = await fetchImpl(`${deeplHost(env.TRANSLATE_API_KEY)}/v2/translate`, {
    method: 'POST', signal: AbortSignal.timeout?.(number(env.TRANSLATE_TIMEOUT_MS, 15000)),
    headers: { 'content-type': 'application/json', authorization: `DeepL-Auth-Key ${env.TRANSLATE_API_KEY}` },
    body: JSON.stringify({ text: payloads, source_lang: 'IT', target_lang: 'EN-GB', tag_handling: 'xml', ignore_tags: ['x'], non_splitting_tags: ['x'], split_sentences: 'nonewlines', preserve_formatting: true })
  });
  if (!response.ok) { const error = new Error(`deepl ${response.status}`); error.status = response.status; throw error; }
  const data = await response.json();
  return (data.translations ?? []).map(item => item.text);
}

// ---- the counters (D1): atomic, shared, fail closed ----
const dayOf = now => new Date(now).toISOString().slice(0, 10);
const monthOf = now => new Date(now).toISOString().slice(0, 7);
// Reserves `chars` against the daily and monthly ceilings in ONE statement: it adds and checks together, so two simultaneous requests can never both pass the same last characters.
export async function reserve(db, chars, limits, now = Date.now()) {
  if (chars > limits.day || chars > limits.month) return { ok: false, reason: 'richiesta-troppo-grande' };
  const day = dayOf(now), month = monthOf(now);
  const result = await db.prepare(`INSERT INTO translate_budget (id, day, day_used, month, month_used, blocked_until, updated_at) VALUES ('global', ?1, ?2, ?3, ?2, 0, ?4)
    ON CONFLICT(id) DO UPDATE SET
      day_used = CASE WHEN day = excluded.day THEN day_used + excluded.day_used ELSE excluded.day_used END,
      month_used = CASE WHEN month = excluded.month THEN month_used + excluded.month_used ELSE excluded.month_used END,
      day = excluded.day, month = excluded.month, updated_at = excluded.updated_at
    WHERE blocked_until <= ?5
      AND (CASE WHEN day = excluded.day THEN day_used ELSE 0 END) + excluded.day_used <= ?6
      AND (CASE WHEN month = excluded.month THEN month_used ELSE 0 END) + excluded.month_used <= ?7`)
    .bind(day, chars, month, new Date(now).toISOString(), now, limits.day, limits.month).run();
  if ((result?.meta?.changes ?? 0) >= 1) return { ok: true };
  const row = await db.prepare("SELECT day, day_used, month, month_used, blocked_until, blocked_reason FROM translate_budget WHERE id = 'global'").first();
  if (row && row.blocked_until > now) return { ok: false, reason: 'bloccato', until: row.blocked_until, detail: row.blocked_reason };
  const dayUsed = row?.day === day ? row.day_used : 0;
  return { ok: false, reason: dayUsed + chars > limits.day ? 'limite-giornaliero' : 'limite-mensile' };
}
export async function blockProvider(db, until, reason, now = Date.now()) {
  await db.prepare("UPDATE translate_budget SET blocked_until = MAX(blocked_until, ?1), blocked_reason = ?2 WHERE id = 'global'").bind(until, String(reason).slice(0, 80)).run();
}
export async function usageOf(db, limits, now = Date.now()) {
  const row = await db.prepare("SELECT day, day_used, month, month_used, blocked_until, blocked_reason FROM translate_budget WHERE id = 'global'").first();
  return {
    day: { used: row?.day === dayOf(now) ? row.day_used : 0, limit: limits.day }, month: { used: row?.month === monthOf(now) ? row.month_used : 0, limit: limits.month },
    blocked: row && row.blocked_until > now ? { until: new Date(row.blocked_until).toISOString(), reason: row.blocked_reason } : null
  };
}
async function rateAllowed(db, ip, limits, now) {
  const window = Math.floor(now / 60000), key = `tr:${ip}:${window}`;
  const result = await db.prepare('INSERT INTO translate_rate (key, n, window) VALUES (?1, 1, ?2) ON CONFLICT(key) DO UPDATE SET n = n + 1 WHERE n < ?3').bind(key, window, limits.rate).run();
  if (Math.random() < .05) await db.prepare('DELETE FROM translate_rate WHERE window < ?1').bind(window - 5).run().catch(() => null);
  return (result?.meta?.changes ?? 0) >= 1;
}
// One text is translated by one request at a time: a second request for the same template, while the first is out, gets "later" (the answer will be in the cache).
async function claim(db, hash, now) {
  const result = await db.prepare('INSERT INTO translate_claims (hash, at) VALUES (?1, ?2) ON CONFLICT(hash) DO UPDATE SET at = excluded.at WHERE at < ?3').bind(hash, now, now - 120000).run();
  return (result?.meta?.changes ?? 0) >= 1;
}

const hex = buffer => [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
const hashOf = async text => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).slice(0, 40);
const cacheKey = hash => `tr:v2:deepl:${hash}`;

// Translates templates: cache first, then (only for what is missing, claimed, reserved and within the limits) one batched call. Returns { translations: { template: english|null }, sent, spent }.
export async function translateTemplates(env, templates, { fetchImpl = fetch, now = Date.now() } = {}) {
  const store = env.TRANSLATION_CACHE ?? env.ADMIN_ARCHIVE, db = env.ACCOUNTS, limits = limitsOf(env);
  const translations = {};
  const missing = [];
  for (const template of [...new Set(templates)]) {
    if (!sendable(template)) { translations[template] = null; continue; }
    const hash = await hashOf(template);
    const hit = await store.get(cacheKey(hash));
    if (typeof hit === 'string') translations[template] = hit; else missing.push({ template, hash });
  }
  if (!missing.length) return { translations, sent: 0, spent: 0 };
  const prepared = missing.map(item => ({ ...item, ...anonymize(item.template) }));
  const total = prepared.reduce((sum, item) => sum + item.payload.length, 0);
  if (total > limits.request) return { translations: { ...translations, ...Object.fromEntries(prepared.map(item => [item.template, null])) }, sent: 0, spent: 0, refused: 'richiesta-troppo-grande' };
  const claimed = [];
  for (const item of prepared) if (await claim(db, item.hash, now)) claimed.push(item); else translations[item.template] = null;
  if (!claimed.length) return { translations, sent: 0, spent: 0, refused: 'in-corso' };
  const chars = claimed.reduce((sum, item) => sum + item.payload.length, 0);
  const booked = await reserve(db, chars, limits, now);
  if (!booked.ok) { for (const item of claimed) translations[item.template] = null; return { translations, sent: 0, spent: 0, refused: booked.reason, until: booked.until }; }
  let answers;
  try { answers = await callDeepL(env, claimed.map(item => item.payload), fetchImpl); }
  catch (error) {
    // quota, authorisation or a server in trouble: no new attempt for hours (456/403: quota or key; 429/5xx: a while)
    const status = Number(error.status ?? 0);
    await blockProvider(db, now + ([456, 403, 401].includes(status) ? 6 * 3600000 : 30 * 60000), `deepl-${status || 'rete'}`, now).catch(() => null);
    for (const item of claimed) translations[item.template] = null;
    return { translations, sent: chars, spent: chars, failed: status || 'rete' };
  }
  for (let i = 0; i < claimed.length; i++) {
    const english = restore(answers[i], claimed[i].values);
    translations[claimed[i].template] = english && english !== claimed[i].template ? english : null;
    if (translations[claimed[i].template]) await store.put(cacheKey(claimed[i].hash), translations[claimed[i].template]);
  }
  return { translations, sent: chars, spent: chars };
}

// ---- the Worker side ----
export async function handleTranslate(request, env, json, url, ensureSchema = async () => {}) {
  const needs = needsOf(env), limits = limitsOf(env);
  if (url.pathname === '/api/translate/status' && request.method === 'GET') {
    let usage = null;
    if (!needs.length) { try { await ensureSchema(env.ACCOUNTS); usage = await usageOf(env.ACCOUNTS, limits); } catch { usage = null; } }
    return json(request, { ok: true, configured: needs.length === 0, provider: needs.length ? null : 'deepl', needs, limits, usage });
  }
  if (url.pathname !== '/api/translate' || request.method !== 'POST') return json(request, { error: 'Richiesta non riconosciuta.' }, 404);
  if (needs.length) return json(request, { ok: false, configured: false, error: 'Traduzione automatica non configurata: i testi restano in italiano.', needs }, 503);
  let body;
  try { body = await request.json(); } catch { return json(request, { error: 'Richiesta non valida.' }, 400); }
  const templates = [...new Set(Array.isArray(body?.texts) ? body.texts : [])].filter(item => typeof item === 'string');
  if (!templates.length || templates.length > limits.texts) return json(request, { error: `Servono da 1 a ${limits.texts} testi.` }, 400);
  try {
    await ensureSchema(env.ACCOUNTS);
    const now = Date.now();
    if (!(await rateAllowed(env.ACCOUNTS, request.headers.get('cf-connecting-ip') ?? 'locale', limits, now))) return json(request, { ok: false, configured: true, error: 'Troppe richieste di traduzione: riprova tra poco.', limit: 'rate' }, 429);
    const result = await translateTemplates(env, templates);
    if (result.refused && ['limite-giornaliero', 'limite-mensile', 'bloccato'].includes(result.refused)) return json(request, { ok: false, configured: true, error: 'Limite di traduzione automatica raggiunto: i testi nuovi restano in italiano.', limit: result.refused, translations: result.translations }, 429);
    return json(request, { ok: true, configured: true, provider: 'deepl', translations: result.translations, refused: result.refused ?? null });
  } catch {
    // the counter (or the cache) did not answer: nothing was sent to DeepL
    return json(request, { ok: false, configured: true, error: 'Servizio di traduzione non disponibile: i testi restano in italiano.' }, 503);
  }
}
