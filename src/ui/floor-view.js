// The sitting of an OPEN vote (core/lawmaking-engine.js `openVotesOf`): the assembly, the measure (title, description, content, proposer), the President who opens the vote, and the player's own ballot —
// Favorevole, Contrario or Astenuto, chosen and then confirmed. Nothing is counted before the confirmation: the window has no result to show until then. Two ways to attend, one resolution:
//   «SEGUI IN DIRETTA»  the President's words come one after the other, the player votes, and the count is then followed seat by seat in the Aula (ui/aula-view.js);
//   «SIMULA VOTAZIONE»  the same sitting in short: the player votes, and the result is shown at the end.
// The window can be left at any moment before the confirmation (the vote stays open, and so does the way chosen to attend it). Loaded only when a vote is open.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const BALLOT_LABELS = Object.freeze({ favorevole: 'Favorevole', contrario: 'Contrario', astenuto: 'Astenuto' });
const LINE_LABELS = Object.freeze({ favorevole: 'a favore', contrario: 'contro', astenuto: 'per l’astensione' });
const whereOf = vote => `${vote.assemblyName}${vote.place ? ` · ${vote.place}` : ''}`;

// The notice of an open vote, with the two ways to attend it: on Home, in the bill's card, in the act's card. It names the measure and the assembly; it never tells a result (there is none yet).
export function floorOffer(vote, { mode = null, compact = false } = {}) {
  const resume = mode ? `<small data-floor-resume>${mode === 'diretta' ? 'Avevi scelto la diretta: la seduta riprende dal tuo voto.' : 'Avevi scelto la simulazione: manca solo il tuo voto.'}</small>` : '';
  const text = compact ? '' : `<small>${esc(vote.summary)}</small>`;
  return `<section class="floor-offer${compact ? ' is-compact' : ''}" data-floor-offer="${esc(vote.id)}" data-floor-scope="${esc(vote.scope)}" aria-label="Votazione aperta">
    <div><span class="section-kicker">VOTAZIONE APERTA · ${esc(vote.reading.toUpperCase())}</span><b class="floor-where">${esc(whereOf(vote).toUpperCase())}</b><strong>${esc(vote.title)}</strong>${text}<small>${esc(vote.kindLabel)} · Proponente: ${esc(vote.proposer)}. L’Aula attende il tuo voto: Favorevole, Contrario o Astenuto. La settimana non si chiude finché non hai votato.</small>${resume}</div>
    <div class="floor-offer-actions">${vote.deferred ? '' : `<button type="button" class="primary-button floor-live" data-floor-open="${esc(vote.id)}" data-floor-mode="diretta">SEGUI IN DIRETTA</button>`}<button type="button" class="${vote.deferred ? 'primary-button floor-live' : 'secondary-button'}" data-floor-open="${esc(vote.id)}" data-floor-mode="simulata">${vote.deferred ? 'ESPRIMI IL TUO VOTO' : 'SIMULA VOTAZIONE'}</button></div>
  </section>`;
}
// All the open votes, as a band (Home).
export function floorBand(votes, modeOf = () => null) {
  if (!votes.length) return '';
  return `<div class="floor-band" data-floor-band data-floor-count="${votes.length}">${votes.map(vote => floorOffer(vote, { mode: modeOf(vote.id) })).join('')}</div>`;
}

let current = null, previousFocus = null;
export function closeFloor() {
  if (!current) return;
  for (const id of current.timers) clearTimeout(id);
  current.root.remove();
  document.removeEventListener('keydown', onKey, true);
  current = null;
  try { previousFocus?.focus?.({ preventScroll: true }); } catch { /* the opener may be gone */ }
}
function onKey(event) { if (event.key === 'Escape' && current && current.root.dataset.floorPhase !== 'conteggio') { event.stopPropagation(); const done = current.onClose; closeFloor(); done?.(); } }

const presidentLines = vote => [
  `${vote.president} apre la seduta: all’ordine del giorno la votazione di «${vote.title}».`,
  `${vote.president}: il testo è presentato da ${vote.proposer}.`,
  vote.confidence && vote.scope !== 'fiducia' ? `${vote.president}: sul provvedimento è posta la questione di fiducia.` : '',
  `${vote.president}: dichiaro aperta la votazione. Ciascuno esprima il proprio voto.`
].filter(Boolean);

function resultHtml(vote, out) {
  const result = out.result;
  if (out.deferred) return `<p class="floor-outcome is-wait" data-floor-outcome="registrato">Il tuo voto è registrato: ${esc(BALLOT_LABELS[out.choice])}.</p><p>La chiama nominale si tiene alla chiusura della settimana: l’esito arriva con il riepilogo.</p>`;
  if (!result) return `<p class="floor-outcome is-wait" data-floor-outcome="ritirato">La votazione non si è tenuta: il testo è stato ritirato prima del voto.</p>`;
  if (result.valid === false) return `<p class="floor-outcome is-wait" data-floor-outcome="rinviata">Manca il numero legale: la seduta è rinviata in seconda convocazione.</p><p>Il tuo voto (${esc(BALLOT_LABELS[out.choice])}) è stato espresso; alla nuova seduta l’aula tornerà a votare.</p>`;
  const cell = (key, label, value, cls) => `<div class="aula-count ${cls}"><small>${label}</small><strong data-floor-count="${key}">${Number(value ?? 0)}</strong></div>`;
  const absent = Number(result.absent ?? 0);
  const voted = Number(result.yes ?? 0) + Number(result.against ?? 0) + Number(result.abstain ?? 0);
  return `<p class="floor-outcome ${result.passed ? 'is-yes' : 'is-no'}" data-floor-outcome="${result.passed ? 'approvato' : 'respinto'}">${result.passed ? 'APPROVATO' : 'RESPINTO'}</p>
    <div class="aula-board floor-board">${cell('yes', 'Favorevoli', result.yes, 'is-yes')}${cell('against', 'Contrari', result.against, 'is-no')}${cell('abstain', 'Astenuti', result.abstain, 'is-abs')}${cell('absent', 'Assenti', absent, 'is-absent')}${cell('voted', 'Hanno votato', voted, 'is-voted')}${cell('total', 'Seggi', result.total, 'is-total')}</div>
    <p class="floor-mine" data-floor-mine="${esc(out.choice)}">Il tuo voto: <b>${esc(BALLOT_LABELS[out.choice])}</b>${result.decisive ? ' — decisivo' : ''}. ${result.needed ? `Voti favorevoli necessari: ${Number(result.needed)}.` : ''}</p>`;
}

// Opens the sitting. `cast(choice)` counts the vote in the game (the store) and returns what the store returns; `aulaOf(out)` gives the Aula of the vote just counted (null when the assembly has no
// hemicycle to show: a committee, an act withdrawn); `play(aula)` follows the count live, seat by seat; `review(aula)` opens it on the result.
export function openFloor(vote, { mode = 'simulata', motion = 'full', cast, aulaOf = () => null, play = null, review = null, onClose = null } = {}) {
  if (!vote || typeof cast !== 'function') return false;
  closeFloor();
  previousFocus = document.activeElement;
  const live = mode === 'diretta' && !vote.deferred;
  const root = document.createElement('div');
  root.className = 'aula-overlay floor-overlay';
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'floor-title');
  root.dataset.floorId = vote.id; root.dataset.floorMode = live ? 'diretta' : 'simulata'; root.dataset.floorPhase = 'seduta'; root.dataset.floorAssembly = vote.assembly;
  const content = vote.content.length ? `<dl class="floor-content">${vote.content.map(item => `<div><dt>${esc(item.label)}</dt><dd>${esc(item.value)}</dd></div>`).join('')}</dl>` : '';
  const choices = Object.entries(BALLOT_LABELS).map(([id, label]) => `<button type="button" class="floor-choice is-${id}" data-floor-choice="${id}" aria-pressed="false">${label}</button>`).join('');
  root.innerHTML = `<div class="aula-window floor-window"><header><div><span class="section-kicker">${live ? 'IN DIRETTA' : vote.deferred ? 'VOTO DI FIDUCIA' : 'VOTAZIONE SIMULATA'} · ${esc(vote.reading.toUpperCase())}</span><p class="floor-assembly" data-floor-assembly-name>${esc(vote.assemblyName.toUpperCase())}</p><small>${esc([vote.hall, vote.place].filter(Boolean).join(' · '))}</small></div><button type="button" class="ghost-button" data-floor-close>Chiudi</button></header>
    <section class="floor-text"><span class="floor-kind">${esc(vote.kindLabel)}</span><h2 id="floor-title">${esc(vote.title)}</h2><p class="floor-summary">${esc(vote.summary)}</p>${content}<p class="floor-proposer">Proponente: <b>${esc(vote.proposer)}</b></p></section>
    <ol class="aula-said floor-said" aria-live="polite"></ol>
    <section class="floor-ballot" data-floor-ballot hidden><h3>IL TUO VOTO</h3><p>Voti di persona: scegli e conferma. L’astensione è un voto espresso, non un’assenza.</p><div class="floor-choices" role="group" aria-label="Il tuo voto">${choices}</div><p class="floor-hint" data-floor-hint>Il tuo gruppo è orientato a votare ${esc(LINE_LABELS[vote.line] ?? vote.line)}: la scelta resta tua.</p><div class="floor-confirm"><button type="button" class="primary-button" data-floor-confirm disabled>CONFERMA IL VOTO</button><small data-floor-picked>Nessun voto scelto.</small></div></section>
    <section class="floor-result" data-floor-result hidden></section></div>`;
  document.body.appendChild(root);
  document.addEventListener('keydown', onKey, true);
  current = { root, timers: [], onClose };
  const said = root.querySelector('.floor-said'), ballot = root.querySelector('[data-floor-ballot]'), confirm = root.querySelector('[data-floor-confirm]'), picked = root.querySelector('[data-floor-picked]');
  const lines = presidentLines(vote);
  const openBallot = () => { const skip = root.querySelector('[data-floor-skip]'); if (skip) skip.hidden = true; ballot.hidden = false; root.dataset.floorPhase = 'voto'; if (vote.intention) pick(vote.intention, true); (root.querySelector('.floor-choice[aria-pressed="true"]') ?? root.querySelector('.floor-choice'))?.focus?.({ preventScroll: true }); };
  const say = index => { const li = document.createElement('li'); li.textContent = lines[index]; said.appendChild(li); };
  let choice = null;
  function pick(id, quiet = false) {
    if (!BALLOT_LABELS[id] || root.dataset.floorPhase !== 'voto') return;
    choice = id;
    root.querySelectorAll('[data-floor-choice]').forEach(button => { const on = button.dataset.floorChoice === id; button.setAttribute('aria-pressed', String(on)); button.classList.toggle('is-picked', on); });
    confirm.disabled = false;
    picked.textContent = quiet ? `La tua intenzione di voto: ${BALLOT_LABELS[id]}. Confermala o cambiala.` : `Hai scelto: ${BALLOT_LABELS[id]}. Puoi cambiare finché non confermi.`;
    root.dataset.floorPicked = id;
  }
  // The live sitting: the President speaks, then the ballot. Simulated (or with the motion off): everything at once.
  const paced = live && motion === 'full' && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (paced) { lines.forEach((_, index) => current.timers.push(setTimeout(() => say(index), 500 + index * 1500))); current.timers.push(setTimeout(openBallot, 500 + lines.length * 1500)); }
  else { lines.forEach((_, index) => say(index)); openBallot(); }
  root.addEventListener('click', event => {
    if (event.target.closest('[data-floor-close]') || (event.target === root && root.dataset.floorPhase !== 'conteggio')) { const done = current?.onClose; closeFloor(); done?.(); return; }
    // «Vai al voto»: the President's words can be skipped, the ballot cannot.
    if (event.target.closest('[data-floor-skip]')) { for (const id of current.timers) clearTimeout(id); current.timers = []; said.innerHTML = ''; lines.forEach((_, index) => say(index)); openBallot(); event.target.closest('[data-floor-skip]').hidden = true; return; }
    const option = event.target.closest('[data-floor-choice]');
    if (option) { pick(option.dataset.floorChoice); return; }
    if (event.target.closest('[data-floor-confirm]') && choice && root.dataset.floorPhase === 'voto') {
      // One confirmation, one count: the buttons are spent at once, so a second tap cannot vote again.
      root.dataset.floorPhase = 'conteggio';
      confirm.disabled = true; root.querySelectorAll('[data-floor-choice]').forEach(button => { button.disabled = true; });
      let out;
      try { out = cast(choice); } catch (error) { root.dataset.floorPhase = 'voto'; confirm.disabled = false; root.querySelectorAll('[data-floor-choice]').forEach(button => { button.disabled = false; }); picked.textContent = error.message; return; }
      const li = document.createElement('li'); li.className = 'is-result'; li.textContent = `Hai votato: ${BALLOT_LABELS[choice]}.`; said.appendChild(li);
      root.dataset.floorCast = choice;
      let aula = null;
      try { aula = out?.result && out.result.valid !== false && !out.deferred ? aulaOf(out) : null; } catch { aula = null; }
      // Live: the count is followed in the Aula, seat by seat (the result comes out there, at the end). Simulated, or with no hemicycle to show: the result here.
      if (live && aula && play) { const done = current?.onClose; current.onClose = null; closeFloor(); play(aula, done); return; }
      ballot.hidden = true;
      const box = root.querySelector('[data-floor-result]');
      box.innerHTML = `${resultHtml(vote, out)}<div class="floor-result-actions">${aula && review ? '<button type="button" class="secondary-button" data-floor-review>Rivedi il voto in Aula</button>' : ''}<button type="button" class="primary-button" data-floor-close>Chiudi</button></div>`;
      box.hidden = false;
      root.dataset.floorPhase = 'esito';
      current.out = out; current.aula = aula;
      box.querySelector('[data-floor-close]')?.focus?.({ preventScroll: true });
      return;
    }
    if (event.target.closest('[data-floor-review]') && current?.aula && review) { const aula = current.aula, done = current.onClose; current.onClose = null; closeFloor(); review(aula, done); }
  });
  if (paced) { const skip = document.createElement('button'); skip.type = 'button'; skip.className = 'ghost-button'; skip.dataset.floorSkip = ''; skip.textContent = 'Vai al voto'; skip.classList.add('floor-skip'); said.before(skip); }
  root.querySelector('[data-floor-close]')?.focus?.({ preventScroll: true });
  return true;
}
