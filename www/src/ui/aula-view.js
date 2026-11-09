// The Aula: a vote the game already decided, replayed seat by seat in a window over the page (core/aula-script.js). Nothing here changes the game: it reads the vote that exists (the Chambers via the
// hemicycle model, a city council / a regional council / the European Parliament via the totals of each group) and lights the seats one after the other in the order the script gives, with the counters
// as the sums of the seats shown and the President's announcements. With the motion off or reduced (or prefers-reduced-motion) the window opens on the final picture; «Vai all’esito» does the same
// at any moment; the vote can be left at any moment (Esc or «Chiudi»). It is loaded only when someone enters the Aula.
import { aulaFromParliamentVote, aulaFromTallies, boardAt, saidAt } from '../core/aula-script.js?v=20261109-3';
import { hemicycleModel } from './hemicycle-view.js?v=20261109-3';
import { hemicycleLayout } from '../core/hemicycle.js?v=20261109-3';
import { VOTE_CHOICES } from '../core/vote-engine.js?v=20261109-3';
import { motionAllows } from './stage-player.js?v=20261109-3';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const COLORS = { ...Object.fromEntries(Object.entries(VOTE_CHOICES).map(([id, spec]) => [id, spec.color])), waiting: '#3a4540' };
let timer = null, current = null, previousFocus = null;

// What a window needs: the seats (position, colour of the group, whose), the choices, the script, the legend of the groups.
export function parliamentAula(state, { voteId, chamber, politicians = [], db = {} }) {
  const model = hemicycleModel(state, { politicians, db, view: { chamber, vote: voteId } });
  if (!model?.summary || !model.individual) return null;
  const { script, seats, choices } = aulaFromParliamentVote({ summary: model.summary, roster: model.roster, individual: model.individual, chamber: model.chamber });
  const positions = model.roster.seats.map(seat => ({ x: seat.x, y: seat.y }));
  const groups = model.roster.groups.map(group => ({ id: group.groupId, label: group.shortName ?? group.name ?? group.groupId, color: group.color }));
  return { script, seats, choices, positions, layout: model.roster.layout, groups, title: model.summary.label ?? 'Votazione', subtitle: model.law?.title ?? '' };
}
// A council, a regional council or the European Parliament: the totals of each group of the vote (local-engine.js).
export function localAula(inst, act, { colorOf = () => '#7d8b84' } = {}) {
  const vote = (act.votes ?? []).at(-1);
  if (!vote?.byGroup?.length || vote.organ === 'giunta') return null;
  const groups = inst.groups.map(group => { const row = vote.byGroup.find(item => item.groupId === group.id) ?? {}; return { id: group.id, label: group.label, color: colorOf(group), seats: group.seats, yes: row.yesVotes ?? 0, against: row.noVotes ?? 0, abstain: row.abstainVotes ?? 0, absent: row.absent ?? 0 }; });
  const assembly = inst.kind === 'regione' ? 'regione' : inst.kind === 'europa' ? 'europeo' : 'comune';
  const built = aulaFromTallies({ assembly, id: act.id, label: act.title, secret: false, passed: Boolean(vote.passed), groups, playerGroupId: inst.playerGroupId ?? null, playerChoice: vote.playerChoice ?? null });
  const layout = hemicycleLayout(built.seats.length, { width: 1000 });
  const colors = new Map(groups.map(group => [group.id, group.color]));
  return { ...built, positions: layout.seats.map(seat => ({ x: seat.x, y: seat.y })), layout, groups: groups.map(group => ({ id: group.id, label: group.label, color: group.color })), title: act.title, subtitle: inst.name, colors };
}

function seatsSvg(aula) {
  const { layout, positions, seats } = aula;
  const radius = Math.min(layout.radius ?? 12, 20);
  const groupColor = new Map(aula.groups.map(group => [group.id, group.color]));
  const circles = seats.map((seat, index) => `<circle class="aula-seat${seat.player ? ' is-player' : ''}" data-seat="${index}" cx="${positions[index].x}" cy="${positions[index].y}" r="${radius.toFixed(1)}" fill="${esc(groupColor.get(seat.groupId) ?? COLORS.waiting)}" fill-opacity=".38"/>`).join('');
  return `<svg class="aula-svg" viewBox="0 0 ${layout.width} ${Math.round(layout.height)}" role="img" aria-label="${esc(`${aula.script.kindLabel}: ${seats.length} seggi`)}"><g>${circles}</g><text class="aula-tag" x="${layout.cx}" y="${Math.round(layout.cy * 0.78)}" text-anchor="middle">${esc(aula.script.kindLabel.toUpperCase())}</text></svg>`;
}
function board(aula, shown) {
  const b = boardAt(aula.script, aula.choices, shown), done = b.left === 0, secret = aula.script.secret;
  const f = aula.script.final;
  const cell = (key, label, value, cls) => `<div class="aula-count ${cls}"><small>${label}</small><strong data-aula-count="${key}">${value}</strong></div>`;
  return `${cell('yes', 'Favorevoli', secret && !done ? '—' : done ? f.yes : b.yes, 'is-yes')}${cell('against', 'Contrari', secret && !done ? '—' : done ? f.against : b.against, 'is-no')}${cell('abstain', 'Astenuti', secret && !done ? '—' : done ? f.abstain : b.abstain, 'is-abs')}${cell('absent', 'Assenti', aula.choices.filter(choice => choice === 'assente').length, 'is-absent')}${cell('voted', 'Hanno votato', b.voted, 'is-voted')}`;
}

function paint(root, aula, shown) {
  const { script, choices } = aula;
  const circles = root.querySelectorAll('.aula-seat');
  const votedAt = new Map(script.order.slice(0, shown).map((index, k) => [index, k]));
  circles.forEach((circle, index) => {
    const choice = choices[index];
    if (choice === 'assente') { circle.setAttribute('fill', COLORS.assente); circle.setAttribute('fill-opacity', '.55'); return; }
    if (votedAt.has(index)) { circle.setAttribute('fill', COLORS[choice] ?? COLORS.segreto); circle.setAttribute('fill-opacity', '1'); circle.classList.add('is-voted'); }
    else { circle.classList.remove('is-voted'); circle.setAttribute('fill-opacity', '.38'); circle.setAttribute('fill', aula.groups.find(group => group.id === aula.seats[index].groupId)?.color ?? COLORS.waiting); }
  });
  const boardEl = root.querySelector('.aula-board'); if (boardEl) boardEl.innerHTML = board(aula, shown);
  const log = root.querySelector('.aula-said');
  if (log) { const lines = saidAt(script, shown); if (log.children.length !== lines.length) log.innerHTML = lines.map(step => `<li class="${step.result ? 'is-result' : ''}">${esc(step.text)}</li>`).join(''); }
  root.dataset.aulaShown = String(shown);
  root.dataset.aulaFinal = shown >= script.order.length ? '1' : '0';
}
function stop() { if (timer) { clearInterval(timer); timer = null; } }
export function closeAula() {
  stop();
  const root = document.querySelector('.aula-overlay');
  if (root) root.remove();
  document.removeEventListener('keydown', onKey, true);
  current = null;
  try { previousFocus?.focus?.({ preventScroll: true }); } catch { /* the opener may be gone */ }
}
function onKey(event) { if (event.key === 'Escape' && current) { event.stopPropagation(); closeAula(); } }

// Opens the window. `motion`: 'full' plays seat by seat (about six seconds); 'reduced' or 'off', or the system preference, show the final picture at once.
export function openAula(aula, { motion = 'off', onClose = null } = {}) {
  if (!aula) return false;
  closeAula();
  previousFocus = document.activeElement;
  const { script } = aula;
  const play = motionAllows(motion);
  const root = document.createElement('div');
  root.className = 'aula-overlay';
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'aula-title');
  root.dataset.aulaChamber = script.assembly;
  const legend = aula.groups.map(group => `<li><i style="background:${esc(group.color)}"></i><span>${esc(group.label)}</span></li>`).join('');
  root.innerHTML = `<div class="aula-window"><header><div><span class="section-kicker">AULA · ${esc(script.kindLabel.toUpperCase())}</span><h2 id="aula-title">${esc(aula.title)}</h2>${aula.subtitle ? `<small>${esc(aula.subtitle)}</small>` : ''}</div><button type="button" class="ghost-button" data-aula-close>Chiudi</button></header>
    <div class="aula-controls" role="group" aria-label="Controlli della votazione">${play ? '<button type="button" class="ghost-button" data-aula-pause aria-pressed="false">Pausa</button>' : ''}<button type="button" class="ghost-button" data-aula-skip>Vai all’esito</button></div>
    ${seatsSvg(aula)}
    <div class="aula-board" role="status"></div>
    <ol class="aula-said" aria-live="polite"></ol>
    <ul class="aula-legend">${legend}<li><i style="background:${COLORS.favorevole}"></i><span>Favorevole</span></li><li><i style="background:${COLORS.contrario}"></i><span>Contrario</span></li><li><i style="background:${COLORS.astenuto}"></i><span>Astenuto</span></li>${script.secret ? `<li><i style="background:${COLORS.segreto}"></i><span>Ha votato (voto segreto)</span></li>` : ''}</ul>
    <p class="sx-note">Votazione simulata: il gioco ha già deciso i voti di ogni gruppo; qui si rivedono, seggio per seggio, senza cambiarli.</p></div>`;
  document.body.appendChild(root);
  document.addEventListener('keydown', onKey, true);
  current = { aula, root };
  let shown = play ? 0 : script.order.length;
  let paused = false;
  paint(root, aula, shown);
  const chunk = Math.max(1, Math.ceil(script.order.length / 70));
  const tick = () => { if (paused) return; shown = Math.min(script.order.length, shown + chunk); paint(root, aula, shown); if (shown >= script.order.length) stop(); };
  if (play) timer = setInterval(tick, 90);
  root.addEventListener('click', event => {
    if (event.target.closest('[data-aula-close]') || event.target === root) { closeAula(); onClose?.(); return; }
    if (event.target.closest('[data-aula-skip]')) { stop(); shown = script.order.length; paint(root, aula, shown); return; }
    const pause = event.target.closest('[data-aula-pause]');
    if (pause) { paused = !paused; pause.setAttribute('aria-pressed', String(paused)); pause.textContent = paused ? 'Riprendi' : 'Pausa'; }
  });
  root.querySelector('[data-aula-skip]')?.focus?.({ preventScroll: true });
  return true;
}
