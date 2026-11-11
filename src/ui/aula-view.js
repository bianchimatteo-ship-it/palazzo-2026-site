// The Aula: a vote the game already decided, replayed seat by seat in a window over the page (core/aula-script.js). Nothing here changes the game: it reads the vote that exists (the Chambers via the
// hemicycle model, a city council / a regional council / the European Parliament via the totals of each group) and lights the seats one after the other in the order the script gives, with the counters
// as the sums of the seats shown and the President's announcements. With the motion off or reduced (or prefers-reduced-motion) the window opens on the final picture; «Vai all’esito» does the same
// at any moment; the vote can be left at any moment (Esc or «Chiudi»). It is loaded only when someone enters the Aula.
import { aulaFromParliamentVote, aulaFromTallies, boardAt, saidAt } from '../core/aula-script.js?v=20261110-24';
import { hemicycleModel } from './hemicycle-view.js?v=20261110-24';
import { hemicycleLayout } from '../core/hemicycle.js?v=20261110-24';
import { VOTE_CHOICES } from '../core/vote-engine.js?v=20261110-24';
import { motionAllows } from './stage-player.js?v=20261110-24';

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
  const assembly = inst.kind === 'regione' ? 'regione' : inst.kind === 'europa' ? 'europeo' : inst.kind === 'provincia' ? 'provincia' : 'comune';
  const built = aulaFromTallies({ assembly, id: act.id, label: act.title, secret: false, passed: Boolean(vote.passed), groups, playerGroupId: inst.playerGroupId ?? null, playerChoice: vote.playerChoice ?? null });
  const layout = hemicycleLayout(built.seats.length, { width: 1000 });
  const colors = new Map(groups.map(group => [group.id, group.color]));
  return { ...built, positions: layout.seats.map(seat => ({ x: seat.x, y: seat.y })), layout, groups: groups.map(group => ({ id: group.id, label: group.label, color: group.color })), title: act.title, subtitle: inst.name, colors };
}

// The seats are drawn inside a frame that has room for the whole circle of every seat: the seats of a small council have a large radius and the first and the last of the arc sit near the edge of the layout, so
// a viewBox of exactly the layout cut them (left, right, top and bottom). The frame grows by the radius of the seat plus a margin on every side.
export function seatsSvg(aula) {
  const { layout, positions, seats } = aula;
  const radius = Math.min(layout.radius ?? 12, 20);
  const pad = Math.ceil(radius + 6);
  const groupColor = new Map(aula.groups.map(group => [group.id, group.color]));
  const circles = seats.map((seat, index) => `<circle class="aula-seat${seat.player ? ' is-player' : ''}" data-seat="${index}" cx="${positions[index].x}" cy="${positions[index].y}" r="${radius.toFixed(1)}" fill="${esc(groupColor.get(seat.groupId) ?? COLORS.waiting)}" fill-opacity=".38"/>`).join('');
  return `<svg class="aula-svg" viewBox="${-pad} ${-pad} ${layout.width + 2 * pad} ${Math.round(layout.height) + 2 * pad}" role="img" aria-label="${esc(`${aula.script.kindLabel}: ${seats.length} seggi`)}"><g>${circles}</g><text class="aula-tag" x="${layout.cx}" y="${Math.round(layout.cy * 0.78)}" text-anchor="middle">${esc(aula.script.kindLabel.toUpperCase())}</text></svg>`;
}
function board(aula, shown) {
  const b = boardAt(aula.script, aula.choices, shown), done = b.left === 0, secret = aula.script.secret;
  const f = aula.script.final;
  const cell = (key, label, value, cls) => `<div class="aula-count ${cls}"><small>${label}</small><strong data-aula-count="${key}">${value}</strong></div>`;
  // the counters are the sums of the seats shown so far (never the final numbers before the last seat), and they always add up: voted + absent = seats when the count is over
  return `${cell('yes', 'Favorevoli', secret && !done ? '—' : done ? f.yes : b.yes, 'is-yes')}${cell('against', 'Contrari', secret && !done ? '—' : done ? f.against : b.against, 'is-no')}${cell('abstain', 'Astenuti', secret && !done ? '—' : done ? f.abstain : b.abstain, 'is-abs')}${cell('absent', 'Assenti', aula.choices.filter(choice => choice === 'assente').length, 'is-absent')}${cell('voted', 'Hanno votato', b.voted, 'is-voted')}${cell('total', 'Seggi', aula.seats.length, 'is-total')}`;
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
  if (log) { const lines = saidAt(script, shown); if (log.children.length !== lines.length) log.innerHTML = lines.map(step => `<li class="${step.result ? 'is-result' : step.mine ? 'is-mine' : ''}">${esc(step.text)}</li>`).join(''); }
  // at the end there is nothing left to pause or to skip to
  root.querySelectorAll('[data-aula-pause],[data-aula-skip]').forEach(button => { button.hidden = shown >= script.order.length && script.order.length > 0; });
  root.dataset.aulaShown = String(shown);
  root.dataset.aulaFinal = shown >= script.order.length ? '1' : '0';
}
function stop() { if (timer) { clearInterval(timer); timer = null; } }
export function closeAula() {
  try { current?.report?.(true); if (current?.leave) removeEventListener('pagehide', current.leave); } catch { /* leaving is never blocked */ }
  stop();
  const root = document.querySelector('.aula-overlay');
  if (root) root.remove();
  document.removeEventListener('keydown', onKey, true);
  current = null;
  try { previousFocus?.focus?.({ preventScroll: true }); } catch { /* the opener may be gone */ }
}
function onKey(event) { if (event.key === 'Escape' && current) { event.stopPropagation(); closeAula(); } }

// Opens the window. `motion`: 'full' plays seat by seat (about six seconds); 'reduced' or 'off', or the system preference, show the final picture at once.
export function openAula(aula, { motion = 'off', onClose = null, start = 0, onProgress = null, review = false, place = '' } = {}) {
  if (!aula) return false;
  closeAula();
  previousFocus = document.activeElement;
  const { script } = aula;
  const play = motionAllows(motion);
  const root = document.createElement('div');
  root.className = 'aula-overlay';
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'aula-title');
  root.dataset.aulaChamber = script.assembly;
  root.dataset.aulaMode = review ? 'storico' : 'diretta';
  const mine = script.playerChoice ? `<p class="aula-mine" data-aula-mine="${esc(script.playerChoice)}">IL TUO VOTO: <b>${esc({ favorevole: 'FAVOREVOLE', contrario: 'CONTRARIO', astenuto: 'ASTENUTO' }[script.playerChoice])}</b></p>` : '';
  const legend = aula.groups.map(group => `<li><i style="background:${esc(group.color)}"></i><span>${esc(group.label)}</span></li>`).join('');
  root.innerHTML = `<div class="aula-window"><header><div><span class="section-kicker">${review ? 'STORICO · VOTAZIONE CONCLUSA' : 'IN DIRETTA · VOTAZIONE IN CORSO'}</span><p class="floor-assembly" data-aula-assembly>${esc(script.kindLabel.toUpperCase())}</p><h2 id="aula-title">${esc(aula.title)}</h2>${(aula.subtitle && aula.subtitle !== aula.title) || place ? `<small>${esc(aula.subtitle && aula.subtitle !== aula.title ? aula.subtitle : place)}</small>` : ''}${mine}</div><button type="button" class="ghost-button" data-aula-close>Chiudi</button></header>
    <div class="aula-controls" role="group" aria-label="Controlli della votazione">${play ? '<button type="button" class="ghost-button" data-aula-pause aria-pressed="false">Pausa</button>' : ''}<button type="button" class="ghost-button" data-aula-skip>Vai all’esito</button></div>
    ${seatsSvg(aula)}
    <div class="aula-board" role="status"></div>
    <ol class="aula-said" aria-live="polite"></ol>
    <ul class="aula-legend">${legend}<li><i style="background:${COLORS.favorevole}"></i><span>Favorevole</span></li><li><i style="background:${COLORS.contrario}"></i><span>Contrario</span></li><li><i style="background:${COLORS.astenuto}"></i><span>Astenuto</span></li>${script.secret ? `<li><i style="background:${COLORS.segreto}"></i><span>Ha votato (voto segreto)</span></li>` : ''}</ul>
    <p class="sx-note">${review ? 'Votazione conclusa: qui si rivede l’esito ufficiale, seggio per seggio, senza cambiarlo.' : 'I voti compaiono seggio per seggio: l’esito si conosce solo quando ha votato l’ultimo seggio.'}</p></div>`;
  document.body.appendChild(root);
  document.addEventListener('keydown', onKey, true);
  current = { aula, root };
  // Resumed from where it was left (the seats shown are the first `start` of the same deterministic order: nothing is drawn again, no vote is recomputed); a finished vote opens on the final picture.
  const total = script.order.length;
  const resumeAt = Math.max(0, Math.min(total, Math.floor(Number(start) || 0)));
  let shown = play ? resumeAt : total;
  let paused = false;
  let lastSaved = -1, savedAt = 0;
  // Progress is reported when it moves, at most about once a second, and always on pause, skip and close (the player may leave at any moment).
  const report = (force = false) => { if (!onProgress || shown === lastSaved) return; const now = Date.now(); if (!force && now - savedAt < 1000 && shown < total) return; lastSaved = shown; savedAt = now; try { onProgress(shown, total, shown >= total); } catch { /* the save is not the vote */ } };
  current.report = report;
  current.leave = () => report(true);
  addEventListener('pagehide', current.leave);
  paint(root, aula, shown);
  // about eleven seconds from the first seat to the last (it was six): the count can be followed, and it can always be paused or skipped
  const chunk = Math.max(1, Math.ceil(script.order.length / 84));
  const tick = () => { if (paused) return; shown = Math.min(script.order.length, shown + chunk); paint(root, aula, shown); report(); if (shown >= script.order.length) { stop(); report(true); } };
  if (play) timer = setInterval(tick, 130);
  root.addEventListener('click', event => {
    if (event.target.closest('[data-aula-close]') || event.target === root) { report(true); closeAula(); onClose?.(); return; }
    if (event.target.closest('[data-aula-skip]')) { stop(); shown = script.order.length; paint(root, aula, shown); report(true); return; }
    const pause = event.target.closest('[data-aula-pause]');
    if (pause) { paused = !paused; if (paused) report(true); pause.setAttribute('aria-pressed', String(paused)); pause.textContent = paused ? 'Riprendi' : 'Pausa'; }
  });
  root.querySelector('[data-aula-skip]')?.focus?.({ preventScroll: true });
  return true;
}
