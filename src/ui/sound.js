// Interface sounds synthesised with the Web Audio API: no audio file is downloaded.
import { loadSettings } from '../core/settings.js?v=20260924-21';

let context = null;
const TONES = Object.freeze({
  click: [[660, 0.05]],
  confirm: [[520, 0.07], [780, 0.09]],
  week: [[392, 0.09], [523, 0.09], [659, 0.14]],
  success: [[523, 0.08], [659, 0.08], [784, 0.16]],
  failure: [[330, 0.12], [247, 0.2]],
  alert: [[880, 0.08], [660, 0.08], [880, 0.12]]
});

export function playSound(kind) {
  const settings = loadSettings();
  if (settings.sound !== 'on' || !TONES[kind]) return;
  try {
    context ??= new (globalThis.AudioContext ?? globalThis.webkitAudioContext)();
    if (context.state === 'suspended') context.resume();
    const volume = Number(settings.volume) / 100 * 0.12;
    let at = context.currentTime;
    for (const [frequency, duration] of TONES[kind]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + duration + 0.02);
      at += duration * 0.85;
    }
  } catch { /* audio unavailable: the game stays silent */ }
}
