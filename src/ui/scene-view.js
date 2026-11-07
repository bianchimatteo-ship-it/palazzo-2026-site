// The scene on screen (scene-engine.js): a 2D stage drawn in SVG (ui/stage-art.js) — the television studio, the square of a rally, the polling station — with the characters built from the game's own
// avatars (the player is always the avatar chosen at the start of the career), the poses and the shots decided by core/stage-script.js and played by ui/stage-player.js. Below the stage: the line,
// the reactions, the choices; above it the controls of the animation (skip, pause, complete / reduced / off). The same scenes with the motion off or reduced: the stage is simply in its final pose.
import { ASKS, CLOSINGS, REPLIES, STYLES, sceneNode, sceneProgress } from '../core/scene-engine.js?v=20261106-2';
import { stageBefore, stageOf } from '../core/stage-script.js?v=20261106-2';
import { renderStageSvg } from './stage-art.js?v=20261106-2';
import { esc } from './charts.js?v=20261106-2';

const KIND_LABELS = { risposta: 'Risposta', domanda: 'Domanda', replica: 'Replica', chiusura: 'Chiusura', saluto: 'Saluto', discorso: 'Discorso', contestazione: 'Contestazione' };
const STYLE_LABELS = { ...Object.fromEntries([...Object.entries(STYLES), ...Object.entries(REPLIES), ...Object.entries(ASKS), ...Object.entries(CLOSINGS)].map(([id, spec]) => [id, spec.label])), caloroso: 'Saluto caloroso', sobrio: 'Saluto sobrio', locale: 'Saluto locale', combattivo: 'Apertura all’attacco', promessa: 'Dalle promesse', territorio: 'Dal territorio', attualita: 'Dall’attualità', governo: 'Dal Governo', proposta: 'Dalla proposta del partito', attacco: 'All’attacco', ascolta: 'Ascoltare', rispondi: 'Rispondere', prosegui: 'Proseguire', interrompi: 'Interrompere', appello: 'Appello al voto', impegno: 'Impegno pubblico', ringraziamento: 'Ringraziamento', coro: 'Slogan' };
const HEAD = {
  'dibattito-tv': ['DIBATTITO TELEVISIVO · IN DIRETTA', scene => `Faccia a faccia: ${scene.topic.label}`, 'Dibattito televisivo'],
  talkshow: ['OSPITE IN STUDIO · IN DIRETTA', scene => `Ospite del talk show: ${scene.topic.label}`, 'Ospitata televisiva'],
  comizio: ['COMIZIO IN PIAZZA', scene => `Piazza di ${scene.place.label}`, 'Comizio in piazza'],
  voto: ['IL TUO VOTO', scene => scene.electionLabel, 'Voto al seggio']
};
const MOTIONS = [['full', 'Complete'], ['reduced', 'Ridotte'], ['off', 'Disattivate']];

function stageData(scene, node) {
  const stage = stageOf(scene, node);
  const earlier = stageBefore(scene, sceneNode);
  const before = earlier ? { camera: earlier.camera, crowd: earlier.crowd, props: earlier.props, protest: earlier.protest ?? false, poses: Object.fromEntries(Object.entries(earlier.poses).map(([id, pose]) => [id, { ...pose }])) } : null;
  return { stage, before };
}
export function renderScene(state, { identity = null, motion = 'off' } = {}) {
  const scene = state.scene;
  if (!scene) return '';
  const node = sceneNode(scene);
  const [kicker, titleOf, aria] = HEAD[scene.kind] ?? HEAD['dibattito-tv'];
  const speaker = scene.cast.find(item => item.id === node.speaker);
  const progress = sceneProgress(scene);
  const { stage, before } = stageData(scene, node);
  const label = `${aria}: ${scene.cast.filter(item => ['giocatore', 'rivale', 'conduttore'].includes(item.role)).map(item => item.name).join(', ')}`;
  const choices = node.choices.map(([id, text, disabled, detail]) => `<button type="button" class="scene-choice${id === 'continua' || id === 'fine' ? ' primary-button' : ''}" data-scene-choice="${esc(id)}"${disabled ? ' disabled' : ''}><strong>${esc(text)}</strong>${detail ? `<small>${esc(detail)}</small>` : ''}</button>`).join('');
  const why = node.why?.length ? `<div class="scene-why"><b>Perché:</b><ul>${node.why.map(item => `<li>${esc(item)}</li>`).join('')}${Number.isFinite(node.score) ? `<li>Esito: ${node.score}/100</li>` : ''}</ul></div>` : '';
  const extra = (node.lines ?? []).map(line => `<p>${esc(line)}</p>`).join('');
  const preface = `${node.said ? `<p class="scene-said"><b>Hai detto:</b> <i>${esc(node.said)}</i></p>` : ''}${(node.preface ?? []).map(line => `<p class="scene-audience-line">${esc(line)}</p>`).join('')}`;
  const result = node.final && scene.outcome && scene.kind !== 'voto' ? `<ul class="scene-result"><li>Prestazione: <strong>${scene.outcome.performance}/100</strong></li><li>Pubblico: ${Math.round(scene.outcome.audience ?? scene.audience.mood)}/100</li>${scene.kind === 'comizio' ? `<li>Contestazione: ${esc({ nessuna: 'nessuna', gestita: 'gestita', incerta: 'incerta, ma il comizio è proseguito', degenerata: 'degenerata: comizio interrotto', interrotta: 'comizio interrotto da te' }[scene.outcome.protest] ?? scene.outcome.protest)}</li>${scene.outcome.pledge ? '<li>Hai preso un impegno pubblico: lo trovi nel Programma.</li>' : ''}` : ''}${scene.outcome.best ? `<li>Momento migliore: ${esc(KIND_LABELS[scene.outcome.best.kind] ?? scene.outcome.best.kind)} · ${esc(STYLE_LABELS[scene.outcome.best.style] ?? scene.outcome.best.style)} ${scene.outcome.best.score}</li>` : ''}${scene.outcome.worst ? `<li>Momento peggiore: ${esc(KIND_LABELS[scene.outcome.worst.kind] ?? scene.outcome.worst.kind)} · ${esc(STYLE_LABELS[scene.outcome.worst.style] ?? scene.outcome.worst.style)} ${scene.outcome.worst.score}</li>` : ''}</ul>` : '';
  const motionNote = motion === 'full' ? '' : `<small class="scene-motion-note">${motion === 'off' ? 'Le animazioni sono disattivate: la scena mostra la posizione di ogni momento.' : 'Animazioni ridotte: la scena mostra la posizione di ogni momento.'}</small>`;
  const controls = `<div class="scene-controls" role="group" aria-label="Controlli dell’animazione"><button type="button" class="ghost-button" data-stage-skip>Salta l’animazione</button><button type="button" class="ghost-button" data-stage-pause aria-pressed="false">Pausa</button><span class="scene-motion" role="group" aria-label="Animazioni">${MOTIONS.map(([id, text]) => `<button type="button" class="ghost-button${motion === id ? ' is-on' : ''}" data-scene-motion="${id}" aria-pressed="${motion === id}">${text}</button>`).join('')}</span>${scene.kind === 'voto' ? '<button type="button" class="ghost-button" data-scene-skip>Salta il voto</button>' : ''}</div>`;
  const speakerName = speaker ? `${speaker.name}${speaker.role === 'giocatore' ? ' · tu' : ''}` : (scene.kind === 'comizio' ? 'In piazza' : scene.kind === 'voto' ? 'Al seggio' : '');
  return `<section class="scene" data-scene-kind="${esc(scene.kind)}" data-scene-node="${esc(scene.nodeId)}" data-stage-seen="${scene.stageSeen === scene.nodeId ? 1 : 0}" aria-label="${esc(aria)}">
    <header class="scene-head"><div><span class="section-kicker">${esc(kicker)}</span><h2>${esc(titleOf(scene))}</h2></div><div class="scene-steps" role="img" aria-label="${esc(`Momento ${progress.index + 1} di ${progress.total}`)}"><span style="width:${Math.round((progress.index + 1) / progress.total * 100)}%"></span></div></header>
    ${controls}${motionNote}
    <div class="scene-stage">${renderStageSvg(scene, stage, node, { identity, before, label })}</div>
    ${scene.kind === 'voto' ? '' : `<div class="scene-meter" role="img" aria-label="${esc(`Umore del pubblico ${Math.round(scene.audience.mood)} su 100`)}"><span>Pubblico</span><b><i style="width:${scene.audience.mood}%"></i></b></div>`}
    <div class="scene-dialogue" aria-live="polite"><span class="scene-speaker">${esc(speakerName)}</span>${node.title ? `<small class="scene-title">${esc(node.title)}</small>` : ''}${preface}<p>${esc(node.text)}</p>${extra}${node.audience ? `<p class="scene-audience-line">${esc(node.audience)}</p>` : ''}${why}${result}</div>
    <div class="scene-choices" role="group" aria-label="Le tue scelte">${choices}</div>
    ${node.final ? '' : `<footer class="scene-foot"><button type="button" class="ghost-button" data-scene-abandon>${scene.kind === 'voto' ? 'Salta il resto' : scene.kind === 'comizio' ? 'Lascia la piazza' : 'Lascia lo studio'}</button><small>${scene.kind === 'voto' ? 'Il voto resta espresso: l’animazione non cambia nulla.' : scene.kind === 'comizio' ? 'Se te ne vai a metà, i costi del comizio sono già pagati e la piazza se ne accorge.' : 'Se te ne vai a metà, è una figuraccia in diretta.'}</small></footer>`}
  </section>`;
}
