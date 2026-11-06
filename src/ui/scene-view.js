// The scene on screen (scene-engine.js): a 2D television studio drawn in SVG — backdrop, desk, podiums, audience — with the avatars of the cast built from the game's own avatar system
// (avatar-svg.js: the player is always the avatar chosen at the start of the career, the others are the avatars of their characters), the speaker animated (mouth, head, gesture, blinking) with
// CSS, the camera that changes shot, the audience that reacts, the line and the choices below. Reduced motion or no animation: the same scenes, nothing moves.
import { avatarParts } from './avatar-svg.js?v=20261106-1';
import { ASKS, CLOSINGS, REPLIES, STYLES, sceneNode, sceneProgress } from '../core/scene-engine.js?v=20261106-1';
import { esc } from './charts.js?v=20261106-1';

const KIND_LABELS = { risposta: 'Risposta', domanda: 'Domanda', replica: 'Replica', chiusura: 'Chiusura' };
const STYLE_LABELS = Object.fromEntries([...Object.entries(STYLES), ...Object.entries(REPLIES), ...Object.entries(ASKS), ...Object.entries(CLOSINGS)].map(([id, spec]) => [id, spec.label]));
const POSITIONS = { sinistra: { x: 14, flip: false }, centro: { x: 118, flip: false }, destra: { x: 222, flip: true } };
const SCALE = 0.62;
function figure(member, { speaking, expression, index }) {
  const pos = POSITIONS[member.position] ?? POSITIONS.centro;
  const uid = `sc${index}${member.id.replace(/[^a-z0-9]/gi, '').slice(0, 8)}`;
  const parts = avatarParts(member.avatar, uid, { expression: expression && member.role !== 'giocatore' ? expression : (expression ?? null) });
  const y = member.role === 'conduttore' ? 52 : 46;
  return `<g class="sc-figure role-${esc(member.role)}${speaking ? ' is-speaking' : ''}" data-cast="${esc(member.id)}" data-avatar="${esc(Object.values(member.avatar).join('.'))}" transform="translate(${pos.x} ${y}) scale(${SCALE})">${parts.defs}${parts.figure}</g>`;
}
function studio(scene, node) {
  const [me, rival, host] = [scene.cast.find(item => item.role === 'giocatore'), scene.cast.find(item => item.role === 'rivale'), scene.cast.find(item => item.role === 'conduttore')];
  const speaker = node.speaker;
  const faces = [rival, host, me].map((member, index) => figure(member, { speaking: member.id === speaker, expression: member.id === speaker ? node.expression : null, index }));
  const mood = scene.audience.mood;
  const audience = Array.from({ length: 18 }, (_, i) => `<g class="sc-aud" style="--i:${i}" transform="translate(${10 + i * 17.5} 168)"><circle cx="0" cy="0" r="5" fill="${['#2d3b34', '#34443c', '#263229'][i % 3]}"/><path d="M-7 12C-7 4 7 4 7 12Z" fill="${['#2d3b34', '#34443c', '#263229'][(i + 1) % 3]}"/></g>`).join('');
  const reaction = node.audience ? (mood >= 58 ? 'applause' : mood < 45 ? 'boo' : 'mixed') : 'quiet';
  return `<svg class="sc-svg" viewBox="0 0 320 180" role="img" aria-label="${esc(`Studio televisivo: ${me.name} e ${rival.name}, conduce ${host.name}`)}">
    <defs><linearGradient id="sc-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16302a"/><stop offset="1" stop-color="#0b1713"/></linearGradient><linearGradient id="sc-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c241f"/><stop offset="1" stop-color="#0d1210"/></linearGradient></defs>
    <g class="sc-cam" data-camera="${esc(node.camera ?? 'wide')}">
      <rect width="320" height="180" fill="url(#sc-bg)"/>
      <g class="sc-backdrop"><rect x="14" y="12" width="92" height="64" rx="3" fill="#1f4a42" opacity=".75"/><rect x="114" y="12" width="92" height="64" rx="3" fill="#24566a" opacity=".7"/><rect x="214" y="12" width="92" height="64" rx="3" fill="#1f4a42" opacity=".75"/>
        <text x="160" y="30" text-anchor="middle" class="sc-title">FACCIA A FACCIA</text><text x="160" y="46" text-anchor="middle" class="sc-topic">${esc(scene.topic.label)}</text></g>
      <rect y="120" width="320" height="60" fill="url(#sc-floor)"/>
      ${faces.join('')}
      <rect x="6" y="118" width="94" height="14" rx="3" fill="#c4a66a"/><rect x="220" y="118" width="94" height="14" rx="3" fill="#c4a66a"/>
      <rect x="100" y="126" width="120" height="16" rx="3" fill="#3a4a42"/><rect x="100" y="126" width="120" height="3" fill="#8ec3d6" opacity=".6"/>
      <text x="53" y="128.5" text-anchor="middle" class="sc-plate">${esc(me.name.split(' ').slice(-1)[0].toUpperCase())}</text><text x="267" y="128.5" text-anchor="middle" class="sc-plate">${esc(rival.name.split(' ').slice(-1)[0].toUpperCase().slice(0, 14))}</text>
      <g class="sc-audience is-${reaction}">${audience}</g>
    </g></svg>`;
}
export function renderScene(state) {
  const scene = state.scene;
  if (!scene) return '';
  const node = sceneNode(scene);
  const speaker = scene.cast.find(item => item.id === node.speaker);
  const progress = sceneProgress(scene);
  const choices = node.choices.map(([id, label, disabled, detail]) => `<button type="button" class="scene-choice${id === 'continua' || id === 'fine' ? ' primary-button' : ''}" data-scene-choice="${esc(id)}"${disabled ? ' disabled' : ''}><strong>${esc(label)}</strong>${detail ? `<small>${esc(detail)}</small>` : ''}</button>`).join('');
  const why = node.why?.length ? `<div class="scene-why"><b>Perché:</b><ul>${node.why.map(item => `<li>${esc(item)}</li>`).join('')}${Number.isFinite(node.score) ? `<li>Esito: ${node.score}/100</li>` : ''}</ul></div>` : '';
  const extra = (node.lines ?? []).map(line => `<p>${esc(line)}</p>`).join('');
  const result = node.final && scene.outcome ? `<ul class="scene-result"><li>Prestazione: <strong>${scene.outcome.performance}/100</strong></li><li>Pubblico: ${Math.round(scene.outcome.audience ?? scene.audience.mood)}/100</li>${scene.outcome.best ? `<li>Momento migliore: ${esc(KIND_LABELS[scene.outcome.best.kind] ?? scene.outcome.best.kind)} · ${esc(STYLE_LABELS[scene.outcome.best.style] ?? scene.outcome.best.style)} ${scene.outcome.best.score}</li>` : ''}${scene.outcome.worst ? `<li>Momento peggiore: ${esc(KIND_LABELS[scene.outcome.worst.kind] ?? scene.outcome.worst.kind)} · ${esc(STYLE_LABELS[scene.outcome.worst.style] ?? scene.outcome.worst.style)} ${scene.outcome.worst.score}</li>` : ''}</ul>` : '';
  return `<section class="scene" data-scene-kind="${esc(scene.kind)}" data-scene-node="${esc(scene.nodeId)}" aria-label="Dibattito televisivo">
    <header class="scene-head"><div><span class="section-kicker">DIBATTITO TELEVISIVO · IN DIRETTA</span><h2>Faccia a faccia: ${esc(scene.topic.label)}</h2></div><div class="scene-steps" role="img" aria-label="${esc(`Momento ${progress.index + 1} di ${progress.total}`)}"><span style="width:${Math.round((progress.index + 1) / progress.total * 100)}%"></span></div></header>
    <div class="scene-stage">${studio(scene, node)}</div>
    <div class="scene-meter" role="img" aria-label="${esc(`Umore del pubblico ${Math.round(scene.audience.mood)} su 100`)}"><span>Pubblico</span><b><i style="width:${scene.audience.mood}%"></i></b></div>
    <div class="scene-dialogue" aria-live="polite"><span class="scene-speaker">${esc(speaker?.name ?? '')}${speaker?.role === 'giocatore' ? ' · tu' : ''}</span>${node.title ? `<small class="scene-title">${esc(node.title)}</small>` : ''}<p>${esc(node.text)}</p>${extra}${node.audience ? `<p class="scene-audience-line">${esc(node.audience)}</p>` : ''}${why}${result}</div>
    <div class="scene-choices" role="group" aria-label="Le tue scelte">${choices}</div>
    ${node.final ? '' : '<footer class="scene-foot"><button type="button" class="ghost-button" data-scene-abandon>Lascia lo studio</button><small>Se te ne vai a metà, è una figuraccia in diretta.</small></footer>'}
  </section>`;
}
