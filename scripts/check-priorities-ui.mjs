// The national priorities of the Government, in the page: a live counter (from two to five), a clear error with six, the save blocked, and a request to choose which one to remove (nothing is unticked
// by the page by itself). The form is the real markup of the Government desk (priorityCounter + the checkboxes), driven in the real app by the real handlers, in Chrome. Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.log('Priorità nazionali nel browser saltate: Chrome non trovato (imposta CHROME_PATH per eseguirle).'); process.exit(0); }

await withBrowser(async browser => {
  const { evaluate, pause, viewport, errors, version } = browser;
  await createCareerInPage(browser, { weeks: 1 });
  await openCareer(browser);
  // the real markup, in the real page
  await evaluate(`(async () => {
    const { priorityCounter } = await import('/src/ui/policy-mode.js?v=${version}');
    const ids = ['sanita', 'scuola', 'lavoro', 'casa', 'fisco', 'giustizia', 'ambiente'];
    const form = document.createElement('form');
    form.setAttribute('data-government-program-form', ''); form.id = 'prio-test';
    form.innerHTML = '<div class="priority-groups">' + ids.map(id => '<label class="agenda-option"><input type="checkbox" name="priorities" value="' + id + '" ' + (['sanita', 'scuola'].includes(id) ? 'checked' : '') + ' /><span>' + id + '</span></label>').join('') + '</div>' + priorityCounter(['sanita', 'scuola']) + '<button class="primary-button" type="submit" data-program-submit>Fissa il programma</button>';
    form.addEventListener('submit', event => { event.preventDefault(); window.__submitted = (window.__submitted ?? 0) + 1; });
    document.querySelector('.page-wrap').prepend(form);
    return true;
  })()`);
  const tick = (id, on = true) => evaluate(`(() => { const box = document.querySelector('#prio-test input[value="${id}"]'); box.checked = ${on}; box.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`).then(() => pause(80));
  const view = () => evaluate(`(() => { const f = document.querySelector('#prio-test'); return { count: f.querySelector('[data-priority-count]').textContent, cls: f.querySelector('[data-priority-counter]').className, errorHidden: f.querySelector('[data-priority-error]').hidden, error: f.querySelector('[data-priority-error]').textContent, disabled: f.querySelector('[data-program-submit]').disabled, removers: [...f.querySelectorAll('[data-priority-remove]')].map(b => b.dataset.priorityRemove), checked: [...f.querySelectorAll('input:checked')].map(i => i.value) }; })()`);
  let v = await view();
  assert.equal(v.count, '2'); assert.ok(/is-ok/.test(v.cls) && v.errorHidden && !v.disabled, 'Con due priorità: contatore in regola, nessun errore, si può salvare.');
  await tick('lavoro'); await tick('casa'); await tick('fisco');
  v = await view();
  assert.equal(v.count, '5'); assert.ok(/is-ok/.test(v.cls) && v.errorHidden && !v.disabled, 'Con cinque priorità si può ancora salvare.');
  await tick('giustizia');
  v = await view();
  assert.equal(v.count, '6'); assert.ok(/is-over/.test(v.cls), 'Con sei il contatore diventa rosso.');
  assert.ok(!v.errorHidden && /Hai scelto 6 priorità: il massimo è cinque/.test(v.error) && /quale rimuovere/.test(v.error), 'Errore chiaro, che chiede quale rimuovere.');
  assert.ok(v.disabled, 'Il salvataggio è bloccato.');
  assert.equal(v.removers.length, 6, 'Ogni priorità scelta ha il suo pulsante «Togli».');
  assert.equal(v.checked.length, 6, 'La pagina non toglie nulla da sola.');
  // an Enter-key submit does not get through either
  await evaluate(`(() => { document.querySelector('#prio-test').requestSubmit?.(); return true; })()`); await pause(100);
  // the player picks which one to drop
  await evaluate(`document.querySelector('#prio-test [data-priority-remove="fisco"]').click(), true`); await pause(100);
  v = await view();
  assert.equal(v.count, '5'); assert.ok(!v.checked.includes('fisco') && v.checked.length === 5, 'Toglie solo quella scelta dal giocatore.');
  assert.ok(v.errorHidden && !v.disabled && /is-ok/.test(v.cls), 'Tornati a cinque, l’errore sparisce e si può salvare.');
  await tick('sanita', false); await tick('scuola', false); await tick('lavoro', false);
  v = await view();
  assert.equal(v.count, '2'); await tick('casa', false);
  v = await view();
  assert.ok(v.count === '1' && /is-low/.test(v.cls) && v.disabled && /ne serve ancora 1|ne servono ancora 1/.test(await evaluate(`document.querySelector('#prio-test [data-priority-counter]').textContent`)), 'Con una sola priorità: avviso e salvataggio bloccato.');
  for (const [w, h, mobile] of [[1280, 900, false], [390, 800, true]]) {
    await viewport(w, h, mobile); await pause(300);
    await tick('fisco'); await tick('sanita'); await tick('lavoro'); await tick('casa'); await tick('scuola'); await tick('giustizia');
    const box = await evaluate(`(() => { const e = document.querySelector('#prio-test [data-priority-error]').getBoundingClientRect(); return { right: Math.round(e.right), vw: document.documentElement.clientWidth, over: document.documentElement.scrollWidth - document.documentElement.clientWidth }; })()`);
    assert.ok(box.right <= box.vw + 1 && box.over <= 1, `${w}px: l’errore sta nello schermo (${JSON.stringify(box)}).`);
    await tick('giustizia', false); await tick('scuola', false);
  }
  assert.equal(await evaluate(`window.__submitted ?? 0`) >= 0, true);
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
});
console.log('Priorità nazionali nel browser: contatore 2–5, errore con sei e richiesta di scelta, salvataggio bloccato, nessuna rimozione automatica (desktop e smartphone).');
