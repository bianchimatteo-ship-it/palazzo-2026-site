// The animation of a stage (ui/stage-art.js): after a beat is drawn in its FINAL pose, this plays the passage from the poses of the beat before — the characters walk (legs and arms swing, the body
// bobs) along their path, sit down, change gesture with the arms (shoulder and elbow), the camera moves to the new shot (a pan, a follow along the walk, a close-up), the crowd reacts, the protesters
// arrive, the ballot travels from the desk to the hand and into the urn. It is made with the Web Animations API on the SVG groups, so that every animation can be paused, resumed or finished at once
// (skip) and the end of the passage is known. Complete motion plays everything; reduced or off motion (and the system preference) show the final pose at once. A beat already played (saved in the
// scene: stageSeen) is never played again: a scene resumed shows the poses of the beat and nothing moves again.
import { CAMERAS, GESTURES, cameraTransform, depthScale, gestureAngles } from './stage-art.js?v=20261110-24';

const SPEED = 118;            // units of the stage per second when walking
const state = { anims: [], paused: false, key: null, timer: null, timers: new Set(), finished: true, listeners: new Set() };
// Every timer of a beat is kept, so that a new beat (or a scene that ends) cancels them: nothing of the old beat goes on after it.
const later = (fn, ms) => { const id = setTimeout(() => { state.timers.delete(id); fn(); }, ms); state.timers.add(id); return id; };
// What is still alive of the stage (for the checks): running animations, those that never end, the timers.
export const stageStats = () => ({ running: state.anims.filter(a => a.playState === 'running').length, endless: state.anims.filter(a => { const t = a.effect?.getComputedTiming?.(); return t && !Number.isFinite(t.endTime); }).length, timers: state.timers.size });
// Ends the stage at once: animations cancelled, timers cleared (used when the beat changes, the scene ends or the page is left).
export function stageStop() { for (const anim of state.anims) { try { anim.cancel(); } catch { /* gone */ } } state.anims = []; for (const id of state.timers) clearTimeout(id); state.timers.clear(); clearTimeout(state.timer); state.finished = true; state.paused = false; }

const prefersReduced = () => { try { return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; } catch { return false; } };
export const motionAllows = motion => motion === 'full' && !prefersReduced();
const track = anim => { state.anims.push(anim); return anim; };
const el = (root, selector) => root.querySelector(selector);
const animate = (target, keyframes, options) => { try { return target?.animate ? track(target.animate(keyframes, { fill: 'both', ...options })) : null; } catch { return null; } };
const cam = name => cameraTransform(name);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const transformAt = (p, flip = 1) => `translate(${p.x}px,${p.y}px) scale(${depthScale(p.y)})`;

export const stagePlaying = () => !state.finished && state.anims.some(anim => anim.playState === 'running' || anim.playState === 'paused');
export function stageSkip() { for (const anim of state.anims) { try { anim.finish(); } catch { /* already over */ } } state.paused = false; }
export function stagePause() { for (const anim of state.anims) { try { anim.pause(); } catch { /* */ } } state.paused = true; }
export function stageResume() { for (const anim of state.anims) { try { anim.play(); } catch { /* */ } } state.paused = false; }
export const stageIsPaused = () => state.paused;

function readPose(node) {
  return { x: Number(node.dataset.x), y: Number(node.dataset.y), s: Number(node.dataset.s), posture: node.dataset.posture, gesture: node.dataset.gesture || null, visible: node.dataset.visible === '1', facing: Number(node.dataset.facing) || 1, path: (() => { try { return JSON.parse(node.dataset.path || '[]'); } catch { return []; } })() };
}
const handOf = (pose, scale = 1) => ({ x: pose.x + 30 * pose.s * pose.facing * scale, y: pose.y - 140 * pose.s });
const BALLOT = { desk: { x: 330, y: 262 }, urn: { x: 160, y: 232 } };

// The walk of one character: waypoints from where it was to where it is, with the swing of the limbs while it moves.
function walkAnimations(root, actor, from, to) {
  const start = from ?? (to.path.length ? { ...to.path[0], visible: true, posture: 'stand', gesture: null } : null);
  if (!start || !to.visible && !from?.visible) return { duration: 0 };
  const points = [{ x: start.x, y: start.y }, ...to.path.filter(p => dist(p, start) > 1), { x: to.x, y: to.y }].filter((p, i, list) => i === 0 || dist(p, list[i - 1]) > 0.5);
  if (points.length < 2) return { duration: 0 };
  let total = 0; const cum = [0]; for (let i = 1; i < points.length; i++) { total += dist(points[i], points[i - 1]); cum.push(total); }
  const duration = Math.max(600, Math.min(7000, total / SPEED * 1000));
  const frames = points.map((p, i) => ({ offset: total ? cum[i] / total : i / (points.length - 1), transform: transformAt(p) }));
  frames[0].offset = 0; frames[frames.length - 1].offset = 1;
  animate(actor, frames, { duration, easing: 'linear' });
  actor.classList.add('is-walking');
  // the swing of the legs and arms and the bob of the body, for as long as the walk lasts
  const cycle = 520;
  const legs = actor.querySelectorAll('.st-leg'), arms = actor.querySelectorAll('.st-arm'), body = actor.querySelector('.st-body');
  const seatShift = to.posture === 'sit' ? 30 : 0;
  legs.forEach((leg, i) => animate(leg, [{ transform: `rotate(${i ? -20 : 20}deg)` }, { transform: `rotate(${i ? 20 : -20}deg)` }], { duration: cycle / 2, iterations: Math.ceil(duration / (cycle / 2)), direction: 'alternate', easing: 'ease-in-out', fill: 'none' }));
  arms.forEach((arm, i) => animate(arm, [{ transform: `rotate(${i ? -18 : 18}deg)` }, { transform: `rotate(${i ? 18 : -18}deg)` }], { duration: cycle / 2, iterations: Math.ceil(duration / (cycle / 2)), direction: 'alternate', easing: 'ease-in-out', fill: 'none' }));
  if (body) animate(body, [{ transform: `translateY(${-3 * 0}px)` }, { transform: 'translateY(-4px)' }], { duration: cycle / 2, iterations: Math.ceil(duration / (cycle / 2)), direction: 'alternate', easing: 'ease-in-out', fill: 'none' });
  void seatShift;
  const done = state.anims.at(-1);
  later(() => actor.classList.remove('is-walking'), duration + 30);
  return { duration, points, cum, total };
}

// The posture and the arms, after the walk: sit down, stand up, change the gesture; then the gesture goes on in a loop while the character speaks.
function poseAnimations(root, actor, from, to, delay) {
  const sit = to.posture === 'sit', wasSit = from?.posture === 'sit';
  const body = actor.querySelector('.st-body');
  if (body && sit !== wasSit) animate(body, [{ transform: wasSit ? 'translateY(30px)' : 'translateY(0px)' }, { transform: sit ? 'translateY(30px)' : 'translateY(0px)' }], { duration: 520, delay, easing: 'ease-in-out' });
  actor.querySelectorAll('.st-leg').forEach(leg => { if (sit !== wasSit) animate(leg, [{ transform: wasSit ? 'scaleY(.62)' : 'scaleY(1)' }, { transform: sit ? 'scaleY(.62)' : 'scaleY(1)' }], { duration: 520, delay, easing: 'ease-in-out' }); });
  const a0 = gestureAngles(from?.gesture, from?.posture), a1 = gestureAngles(to.gesture, to.posture);
  for (const side of ['l', 'r']) {
    const arm = actor.querySelector(`.st-arm-${side}`), fore = arm?.querySelector('.st-fore');
    animate(arm, [{ transform: `rotate(${a0[side][0]}deg)` }, { transform: `rotate(${a1[side][0]}deg)` }], { duration: 520, delay, easing: 'ease-in-out' });
    animate(fore, [{ transform: `rotate(${a0[side][1]}deg)` }, { transform: `rotate(${a1[side][1]}deg)` }], { duration: 520, delay, easing: 'ease-in-out' });
  }
  if (!from || from.visible !== to.visible) animate(actor, [{ opacity: to.visible ? 0 : 1 }, { opacity: to.visible ? 1 : 0 }], { duration: 400, delay, easing: 'ease-in-out' });
}
// What a gesture does: it starts after the passage, develops a few times (the forearm that underlines, the arms that open, the hand that waves) and ENDS back on the pose of the beat: nothing repeats
// for ever. The number of repetitions and the speed vary with the gesture, so that two characters never move in the same way.
const GESTURE_CYCLES = { saluta: [3, 420], scrive: [3, 300], indica: [2, 760], sottolinea: [2, 840], pensa: [1, 1100], prende: [1, 900], inserisce: [1, 900], porge: [1, 900], apre: [2, 900], applaude: [4, 300], scuote: [3, 360] };
function gestureLoop(actor, to, delay) {
  const side = ['indica', 'sottolinea', 'saluta', 'pensa', 'scrive', 'prende', 'inserisce', 'porge'].includes(to.gesture) ? 'r' : null;
  const angles = gestureAngles(to.gesture, to.posture);
  const [cycles, speed] = GESTURE_CYCLES[to.gesture] ?? [2, 800];
  const options = { duration: speed, delay, direction: 'alternate', iterations: cycles * 2, easing: 'ease-in-out', fill: 'none' };
  if (to.gesture === 'apre') for (const s of ['l', 'r']) { const arm = actor.querySelector(`.st-arm-${s}`); animate(arm, [{ transform: `rotate(${angles[s][0]}deg)` }, { transform: `rotate(${angles[s][0] * 0.78}deg)` }], options); }
  else if (side) {
    const fore = actor.querySelector(`.st-arm-${side} .st-fore`);
    const swing = to.gesture === 'saluta' ? 26 : to.gesture === 'scrive' ? 7 : to.gesture === 'indica' ? 6 : 16;
    animate(fore, [{ transform: `rotate(${angles[side][1]}deg)` }, { transform: `rotate(${angles[side][1] + swing}deg)` }], options);
  }
}

export function playStage(root, { motion = 'off', seen = false, autoplay = false, onSeen = null, onEnd = null } = {}) {
  stageStop();
  const svg = el(root, '.st-svg');
  if (!svg) return;
  let data; try { data = JSON.parse(svg.dataset.stage || '{}'); } catch { data = {}; }
  const key = `${svg.dataset.setting}|${data.node}`;
  state.key = key;
  const finishUp = () => { state.finished = true; onSeen?.(data.node); if (autoplay && onEnd) state.timer = setTimeout(onEnd, 650); };
  if (!motionAllows(motion) || seen) { if (!seen) onSeen?.(data.node); if (autoplay && onEnd && motionAllows(motion) === false) { /* no autoplay without motion: the buttons lead */ } return; }
  const before = data.before;
  const cameraGroup = el(root, '.st-cam');
  state.finished = false;
  let longest = 0;
  // the characters
  for (const actor of root.querySelectorAll('.st-actor')) {
    const to = readPose(actor), from = before?.poses?.[actor.dataset.actor] ?? null;
    const moved = from ? (Math.abs(from.x - to.x) > 1 || Math.abs(from.y - to.y) > 1) : to.path.length > 0;
    const walk = (moved || to.path.length && !from) ? walkAnimations(root, actor, from ?? null, to) : { duration: 0 };
    poseAnimations(root, actor, from, to, walk.duration);
    gestureLoop(actor, to, walk.duration + 560);
    longest = Math.max(longest, walk.duration + 560);
    if (walk.points && data.setting === 'seggio') actor.dataset.walk = '1';
    // the ballot follows the hand
    if (walk.points && root.querySelector('.st-ballot')?.dataset.ballot === 'hand') {
      const ballot = root.querySelector('.st-ballot'), frames = walk.points.map((p, i) => { const h = handOf({ ...to, x: p.x, y: p.y, s: depthScale(p.y) }); return { offset: walk.total ? walk.cum[i] / walk.total : i / (walk.points.length - 1), transform: `translate(${h.x}px,${h.y}px)` }; });
      animate(ballot, frames, { duration: walk.duration, easing: 'linear' });
    }
  }
  // the ballot from the desk to the hand, folded, into the urn
  const ballot = root.querySelector('.st-ballot');
  if (ballot && !ballot.getAnimations().length) {
    const kind = ballot.dataset.ballot, final = ballot.style.transform;
    const hand = root.querySelector('.st-actor[data-actor="giocatore"]');
    const h = hand ? handOf(readPose(hand)) : null;
    const startPos = { desk: BALLOT.desk, hand: h, folded: h, urn: h, none: BALLOT.urn }[before?.props?.ballot ?? 'none'];
    const endPos = { desk: BALLOT.desk, hand: h, folded: h, urn: BALLOT.urn, none: { x: -99, y: -99 } }[kind];
    if (startPos && endPos && (startPos.x !== endPos.x || startPos.y !== endPos.y)) animate(ballot, [{ transform: `translate(${startPos.x}px,${startPos.y}px)` }, { transform: `translate(${endPos.x}px,${endPos.y}px)` }], { duration: 900, delay: 400, easing: 'ease-in-out' });
    if (kind === 'folded') animate(ballot.firstElementChild, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(.5)' }], { duration: 500, easing: 'ease-in-out', fill: 'both' });
    if (kind === 'urn') animate(ballot, [{ opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 1400, delay: 700, easing: 'ease-in', fill: 'both' });
    void final;
  }
  // the curtain of the booth
  const curtain = root.querySelector('.st-curtain');
  if (curtain && before?.props?.booth && before.props.booth !== data.props?.booth) {
    const closed = curtain.classList.contains('is-closed');
    animate(curtain, [{ transform: `translate(${closed ? 530 : 474}px,300px) scaleX(${closed ? 0.16 : 1})` }, { transform: `translate(${closed ? 474 : 530}px,300px) scaleX(${closed ? 1 : 0.16})` }], { duration: 520, delay: 150, easing: 'ease-in-out' });
  }
  // the protesters walk in
  const protest = el(root, '.st-protest');
  if (protest && !before?.protest) animate(protest, [{ transform: 'translateX(300px)', opacity: 0.2 }, { transform: 'translateX(0px)', opacity: 1 }], { duration: 2400, easing: 'ease-out' }), longest = Math.max(longest, 2400);
  // the camera: from the shot of the beat before to this one; the follow shot goes along the walk; the panorama sweeps the square
  if (cameraGroup) {
    const target = cam(data.camera);
    if (data.camera === 'follow') {
      const player = [...root.querySelectorAll('.st-actor')].find(a => a.dataset.actor === 'giocatore'), to = player ? readPose(player) : null;
      if (to?.path?.length) { const pts = [to.path[0], ...to.path.slice(1), { x: to.x, y: to.y }]; const frames = pts.map((p, i) => { const c = { x: p.x, y: 262 - Math.max(0, 332 - p.y) * 0.4, s: 1.35 + i * 0.12 }; return { offset: i / (pts.length - 1), transform: `translate(${(320 - c.s * c.x).toFixed(1)}px,${(180 - c.s * c.y).toFixed(1)}px) scale(${c.s})` }; }); const total = pts.reduce((sum, p, i) => i ? sum + dist(p, pts[i - 1]) : 0, 0); animate(cameraGroup, frames, { duration: Math.max(900, total / SPEED * 1000), easing: 'ease-in-out' }); longest = Math.max(longest, Math.max(900, total / SPEED * 1000)); }
    } else if (data.camera === 'panorama') {
      const f = fx => `translate(${(320 - 1.25 * fx).toFixed(1)}px,${(180 - 1.25 * 190).toFixed(1)}px) scale(1.25)`;
      animate(cameraGroup, [{ transform: f(130) }, { transform: f(510) }, { transform: target }], { duration: 4200, easing: 'ease-in-out', offset: undefined }); longest = Math.max(longest, 4200);
    } else if (before?.camera && before.camera !== data.camera) { animate(cameraGroup, [{ transform: cam(before.camera) }, { transform: target }], { duration: 1300, easing: 'ease-in-out' }); longest = Math.max(longest, 1300); }
  }
  // the crowd: a burst of reaction when it changes
  const crowd = el(root, '.st-crowd');
  if (crowd && before?.crowd && before.crowd !== data.crowd) { crowd.classList.add('is-burst'); later(() => crowd.classList.remove('is-burst'), 1900); }
  const finite = state.anims.filter(anim => { const t = anim.effect?.getComputedTiming?.(); return t && Number.isFinite(t.endTime); });
  Promise.all(finite.map(anim => anim.finished.catch(() => 'cancelled'))).then(results => { if (state.key !== key || results.includes('cancelled')) return; finishUp(); });
  if (!finite.length) finishUp();
  void longest;
}
export { CAMERAS, GESTURES };
