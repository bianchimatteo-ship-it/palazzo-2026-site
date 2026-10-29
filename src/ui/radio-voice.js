// The bulletin of Radio La Politica 24 read aloud by the speech synthesis of the device itself (the Web Speech API): no audio file is downloaded and nothing is sent anywhere, the voice is whatever the
// device has. Where the device has no speech synthesis (or no Italian voice) the control is not shown and the text of the bulletin stays on the page. The script is written from the bulletins the
// engine already wrote (never invented here), and it says out loud that the radio is a simulation.
import { LP24 } from '../data/simulation/news-rules.js?v=20261029-4';
import { formatDate } from '../core/time.js?v=20261029-4';

export const voiceSupported = (scope = globalThis) => Boolean(scope.speechSynthesis) && typeof scope.SpeechSynthesisUtterance === 'function';
const ITALIAN = /^it([-_]|$)/i;
const voicesOf = scope => { try { return scope.speechSynthesis?.getVoices?.() ?? []; } catch { return []; } };
// Some browsers list their voices late; an empty list is "not known yet", not "none". With a list and no Italian voice in it the reading would come out in the wrong language: no control then.
export const italianVoiceMissing = (scope = globalThis) => { const voices = voicesOf(scope); return voices.length > 0 && !voices.some(voice => ITALIAN.test(voice.lang ?? '')); };
export const voiceAvailable = (scope = globalThis) => voiceSupported(scope) && !italianVoiceMissing(scope);
export const italianVoices = (scope = globalThis) => voicesOf(scope).filter(voice => ITALIAN.test(voice.lang ?? ''));
// A reading is a little faster than the default (which drags on a long bulletin) and still clear: 1.12 stays natural on every engine.
export const READING_RATE = 1.12;
// One Italian voice per reading, chosen at random among the BEST ones the device really has (never the one of the reading before when there is another), the same for every sentence of that
// reading. A voice is ranked by what makes it pleasant and reliable: an Italian (it-IT) one first, a voice installed on the device before a network one (which may need a connection), the
// natural/neural/premium ones before the plain ones, and the robotic engines (eSpeak, compact, Festival) last. With a single voice that is the voice; with none the language alone is set.
// The list may arrive late (voiceschanged): it is asked again at each sentence until a voice is found, and the page is told when it arrives so that the control appears.
let lastVoiceKey = null;
const voiceKey = voice => `${voice.voiceURI ?? ''}|${voice.name ?? ''}|${voice.lang ?? ''}`;
export function voiceScore(voice) {
  const name = String(voice?.name ?? '');
  let score = 0;
  if (/^it[-_]IT$/i.test(voice?.lang ?? '')) score += 3; else score += 1;
  if (voice?.localService) score += 2;
  if (/natural|neural|premium|enhanced|wavenet|siri|google|microsoft|alice|elsa|luca|federica/i.test(name)) score += 2;
  if (/espeak|compact|festival|mbrola|robot/i.test(name)) score -= 6;
  return score;
}
export const rankedVoices = (scope = globalThis) => italianVoices(scope).map(voice => ({ voice, score: voiceScore(voice) })).sort((a, b) => b.score - a.score || voiceKey(a.voice).localeCompare(voiceKey(b.voice))).map(entry => entry.voice);
export function pickVoice(scope = globalThis, random = Math.random, { avoid = [] } = {}) {
  const ranked = rankedVoices(scope).filter(voice => !avoid.includes(voiceKey(voice)));
  if (!ranked.length) return null;
  const best = voiceScore(ranked[0]);
  const pool = ranked.filter(voice => voiceScore(voice) >= best - 1);
  const others = pool.filter(voice => voiceKey(voice) !== lastVoiceKey);
  const from = others.length ? others : pool;
  const voice = from[Math.min(from.length - 1, Math.floor(Math.max(0, Math.min(0.999999, Number(random()) || 0)) * from.length))];
  lastVoiceKey = voiceKey(voice);
  return voice;
}
// Why there is no reading control on this device, for the page to say (the transcript is always there): 'no-api' (no speech synthesis), 'no-italian-voice' (voices listed, none Italian) or null.
export const voiceUnavailableReason = (scope = globalThis) => !voiceSupported(scope) ? 'no-api' : italianVoiceMissing(scope) ? 'no-italian-voice' : null;
// The late list of voices: the page is told once it arrives (or changes), so a control that was not there can appear.
const voicesListeners = new Set();
let voicesHooked = false;
export function onVoicesChange(listener, scope = globalThis) {
  voicesListeners.add(listener);
  const synth = scope.speechSynthesis;
  if (synth && !voicesHooked) {
    voicesHooked = true;
    const notify = () => { for (const fn of voicesListeners) { try { fn(); } catch { /* a listener must not break the others */ } } };
    try { if (synth.addEventListener) synth.addEventListener('voiceschanged', notify); else synth.onvoiceschanged = notify; } catch { /* the voices are then read when needed */ }
  }
  return () => voicesListeners.delete(listener);
}

const say = value => String(Math.round(Number(value) * 10) / 10).replace('.', ',');
const ORDER = ['notiziario', 'sondaggi', 'territorio', 'palazzo'];
// The sentences of the latest week's bulletins, in the order of the programmes: [{ id, text, kind }]. Empty without bulletins.
export function bulletinScript(bulletins = []) {
  const list = Array.isArray(bulletins) ? bulletins.filter(item => item && Number.isFinite(item.week)) : [];
  if (!list.length) return [];
  const week = Math.max(...list.map(item => item.week));
  const current = list.filter(item => item.week === week).sort((a, b) => ORDER.indexOf(a.programme) - ORDER.indexOf(b.programme));
  const lines = [{ id: 'apertura', kind: 'apertura', text: `${LP24.radio.name}. Notiziario della settimana ${week}, ${formatDate(current[0].date)}.` }];
  for (const bulletin of current) {
    lines.push({ id: `${bulletin.id}:titolo`, kind: 'titolo', text: `${bulletin.label}.` });
    if (bulletin.intro) lines.push({ id: `${bulletin.id}:intro`, kind: 'intro', text: String(bulletin.intro).replace(/\s*%/g, ' per cento') });
    for (const item of bulletin.items ?? []) lines.push({ id: `${bulletin.id}:${item.articleId}`, kind: 'notizia', text: `${item.breaking ? 'Ultima ora. ' : ''}${item.headline}. ${item.outlet ? `Da ${item.outlet}.` : ''}`.trim() });
    for (const figure of bulletin.figures ?? []) lines.push({ id: `${bulletin.id}:${figure.label}`, kind: 'dato', text: `${figure.label}: ${say(figure.share)} per cento.` });
  }
  lines.push({ id: 'chiusura', kind: 'chiusura', text: 'Questo notiziario è simulato: racconta i fatti della partita, non notizie reali.' });
  return lines;
}

// The text of one article, as it is read: the headline, the paragraphs and the source (a simulation: it says so).
export function articleScript(article) {
  if (!article?.headline) return [];
  const body = (Array.isArray(article.body) ? article.body : []).map(paragraph => String(paragraph ?? '').trim()).filter(Boolean);
  const lines = [{ id: 'titolo', kind: 'titolo', text: `${String(article.headline).trim().replace(/[.!?]*$/, '')}.` }, ...body.map((text, index) => ({ id: `testo-${index}`, kind: 'testo', text: text.replace(/\s*%/g, ' per cento') }))];
  lines.push({ id: 'fonte', kind: 'chiusura', text: `${article.outlet ? `${article.outlet}. ` : ''}Articolo simulato dai fatti della partita, non una notizia reale.` });
  return lines;
}

// ---------- the reading ----------
let status = 'idle', line = -1, token = 0, target = null, failure = null;
const listeners = new Set();
export const voiceStatus = () => status;
export const voiceLine = () => line;
// What went wrong with the last reading, for the page to say: { code, message } or null. The text of the bulletin or article stays on the page either way.
export const voiceError = () => failure;
// What is being read: 'bulletin' or 'article:<id>' (the button that started it says the same in data-voice-target).
export const voiceTarget = () => status === 'speaking' ? target : null;
export const onVoiceChange = listener => { listeners.add(listener); return () => listeners.delete(listener); };
const change = (nextStatus, nextLine = -1) => { status = nextStatus; line = nextLine; for (const listener of listeners) { try { listener({ status, line }); } catch { /* a listener must not stop the reading */ } } };
const ERROR_TEXT = {
  blocked: 'Il browser ha bloccato la lettura: tocca di nuovo il pulsante per avviarla.',
  'no-voice': 'Questo dispositivo non riesce a leggere ad alta voce in italiano: leggi la trascrizione qui sotto.',
  silent: 'La voce non si è avviata: leggi la trascrizione qui sotto o riprova.',
  failed: 'La lettura si è interrotta: leggi la trascrizione qui sotto o riprova.'
};
const START_WAIT_MS = 6000;

export function stopVoice(scope = globalThis) {
  token++; target = null;
  try { scope.speechSynthesis?.cancel(); } catch { /* nothing to cancel */ }
  if (status !== 'idle') change('idle');
}
const fail = (code, mine) => { if (mine !== token) return; failure = { code, message: ERROR_TEXT[code] ?? ERROR_TEXT.failed }; target = null; change('error'); };
// Reads the lines one after the other (a sentence at a time: long texts are cut off by some browsers). `volume`: 0–1. A voice that cannot speak is replaced by the next best one for the same
// sentence (once per voice); a browser that blocks speech, a device with no usable voice and a voice that never starts are reported (voiceError()) and never leave the page waiting.
export function speakLines(lines, { volume = 1, rate = READING_RATE, scope = globalThis, what = 'bulletin', random = Math.random, startWait = START_WAIT_MS } = {}) {
  if (!voiceAvailable(scope) || !lines?.length) return false;
  stopVoice(scope);
  failure = null;
  target = what;
  const mine = ++token, synth = scope.speechSynthesis;
  const failed = [];
  let voice = pickVoice(scope, random);
  const next = index => {
    if (mine !== token) return;
    if (index >= lines.length) { change('idle'); return; }
    let utterance, started = false, timer = null;
    const retry = code => {
      clearTimeout(timer);
      if (mine !== token) return;
      if (voice) failed.push(voiceKey(voice));
      const other = pickVoice(scope, random, { avoid: failed });
      if (other && failed.length < 4) { voice = other; try { synth.cancel(); } catch { /* nothing to cancel */ } next(index); return; }
      fail(code, mine);
    };
    try {
      if (!voice) voice = pickVoice(scope, random, { avoid: failed });
      utterance = new scope.SpeechSynthesisUtterance(lines[index].text);
      utterance.lang = voice?.lang ?? 'it-IT';
      if (voice) utterance.voice = voice;
      utterance.volume = Math.max(0, Math.min(1, Number(volume)));
      utterance.rate = Math.max(0.5, Math.min(1.6, Number(rate) || READING_RATE));
      utterance.onstart = () => { started = true; clearTimeout(timer); if (mine === token && line !== index) change('speaking', index); };
      utterance.onend = () => { clearTimeout(timer); next(index + 1); };
      // A cancelled reading ends quietly; a block by the browser is said; a voice that cannot speak gives way to the next one; anything else stops the reading.
      utterance.onerror = event => {
        clearTimeout(timer);
        if (mine !== token) return;
        const code = event?.error ?? '';
        if (code === 'canceled' || code === 'interrupted') { change('idle'); return; }
        if (code === 'not-allowed') { fail('blocked', mine); return; }
        if (['voice-unavailable', 'language-unavailable', 'synthesis-unavailable', 'synthesis-failed', 'audio-hardware', 'audio-busy'].includes(code)) { retry('no-voice'); return; }
        fail('failed', mine);
      };
      change('speaking', index);
      synth.speak(utterance);
      // Some devices accept the sentence and never speak it: after a while the next voice is tried, and then the reading is reported as silent.
      timer = setTimeout(() => { if (!started && mine === token) retry('silent'); }, startWait);
    } catch { if (mine === token) fail('failed', mine); }
  };
  next(0);
  return true;
}

// Keeps the controls and the highlighted sentence of the page in step with the reading, without drawing the whole page again.
export function syncVoiceDom(root) {
  if (!root?.querySelectorAll) return;
  const speaking = status === 'speaking';
  for (const button of root.querySelectorAll('[data-voice-target]')) {
    const mine = speaking && button.dataset.voiceTarget === target;
    const label = button.querySelector('[data-voice-label]');
    if (label) label.textContent = mine ? button.dataset.voiceActive : button.dataset.voiceIdle;
    button.setAttribute('aria-pressed', String(mine));
    button.classList.toggle('is-on-air', mine);
  }
  for (const item of root.querySelectorAll('[data-radio-line]')) item.classList.toggle('is-reading', speaking && target === 'bulletin' && Number(item.dataset.radioLine) === line);
}
