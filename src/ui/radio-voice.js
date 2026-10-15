// The bulletin of Radio La Politica 24 read aloud by the speech synthesis of the device itself (the Web Speech API): no audio file is downloaded and nothing is sent anywhere, the voice is whatever the
// device has. Where the device has no speech synthesis (or no Italian voice) the control is not shown and the text of the bulletin stays on the page. The script is written from the bulletins the
// engine already wrote (never invented here), and it says out loud that the radio is a simulation.
import { LP24 } from '../data/simulation/news-rules.js?v=20261014-1';
import { formatDate } from '../core/time.js?v=20261014-1';

export const voiceSupported = (scope = globalThis) => Boolean(scope.speechSynthesis) && typeof scope.SpeechSynthesisUtterance === 'function';
const ITALIAN = /^it([-_]|$)/i;
const voicesOf = scope => { try { return scope.speechSynthesis?.getVoices?.() ?? []; } catch { return []; } };
// Some browsers list their voices late; an empty list is "not known yet", not "none". With a list and no Italian voice in it the reading would come out in the wrong language: no control then.
export const italianVoiceMissing = (scope = globalThis) => { const voices = voicesOf(scope); return voices.length > 0 && !voices.some(voice => ITALIAN.test(voice.lang ?? '')); };
export const voiceAvailable = (scope = globalThis) => voiceSupported(scope) && !italianVoiceMissing(scope);
const pickVoice = scope => { const italian = voicesOf(scope).filter(voice => ITALIAN.test(voice.lang ?? '')); return italian.find(voice => voice.localService) ?? italian[0] ?? null; };

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
let status = 'idle', line = -1, token = 0, target = null;
const listeners = new Set();
export const voiceStatus = () => status;
export const voiceLine = () => line;
// What is being read: 'bulletin' or 'article:<id>' (the button that started it says the same in data-voice-target).
export const voiceTarget = () => status === 'speaking' ? target : null;
export const onVoiceChange = listener => { listeners.add(listener); return () => listeners.delete(listener); };
const change = (nextStatus, nextLine = -1) => { status = nextStatus; line = nextLine; for (const listener of listeners) { try { listener({ status, line }); } catch { /* a listener must not stop the reading */ } } };

export function stopVoice(scope = globalThis) {
  token++; target = null;
  try { scope.speechSynthesis?.cancel(); } catch { /* nothing to cancel */ }
  if (status !== 'idle') change('idle');
}
// Reads the lines one after the other (a sentence at a time: long texts are cut off by some browsers). `volume`: 0–1.
export function speakLines(lines, { volume = 1, rate = 1, scope = globalThis, what = 'bulletin' } = {}) {
  if (!voiceAvailable(scope) || !lines?.length) return false;
  stopVoice(scope);
  target = what;
  const mine = ++token, synth = scope.speechSynthesis, voice = pickVoice(scope);
  const next = index => {
    if (mine !== token) return;
    if (index >= lines.length) { change('idle'); return; }
    let utterance;
    try {
      utterance = new scope.SpeechSynthesisUtterance(lines[index].text);
      utterance.lang = voice?.lang ?? 'it-IT';
      if (voice) utterance.voice = voice;
      utterance.volume = Math.max(0, Math.min(1, Number(volume)));
      utterance.rate = rate;
      utterance.onstart = () => { if (mine === token && line !== index) change('speaking', index); };
      utterance.onend = () => next(index + 1);
      // A cancelled reading ends quietly; any other error stops it (the text stays on the page).
      utterance.onerror = () => { if (mine === token) change('idle'); };
      change('speaking', index);
      synth.speak(utterance);
    } catch { if (mine === token) change('idle'); }
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
