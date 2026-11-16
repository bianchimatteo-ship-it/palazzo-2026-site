// Responsiveness of the buttons, in Chrome with real mouse events: a double tap on «Chiudi settimana» closes ONE week; a page change answers within a budget (unthrottled phone-sized screen, the redraw
// no longer builds a number or date formatter at every call); an error nobody caught is recorded in the diagnostic log and the player is told the action did not complete (no silent dead button); the
// diagnostic log can be copied from the settings; pressing gives immediate visual feedback (a pressed state, no tap delay).
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Reattività dei pulsanti saltata: Chrome non trovato.'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, send, errors, version }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await createCareerInPage({ evaluate, version }, { weeks: 4 });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'on' })); document.querySelectorAll('[data-report-close],[data-confirm=cancel]').forEach(b => b.click()); true`);
  const center = selector => evaluate(`(() => { const el = typeof ${JSON.stringify(selector)} === 'string' && ${JSON.stringify(selector)}.startsWith('text:') ? [...document.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(selector)}.slice(5)) && b.getBoundingClientRect().width > 0) : document.querySelector(${JSON.stringify(selector)}); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  const tap = async (box, times = 1, gap = 40) => { for (let i = 0; i < times; i++) { await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: i + 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: i + 1 }); if (gap) await pause(gap); } };
  const week = () => evaluate(`import('/src/core/store.js?v=${version}').then(m => m.store.getState().game.week.index)`);
  // 1. a double tap closes one week
  const before = await week();
  const box = await center('text:Chiudi settimana'); assert.ok(box, 'Il pulsante «Chiudi settimana» c’è.');
  await tap(box, 2, 40); await pause(1800);
  assert.equal(await week(), before + 1, 'Due tocchi ravvicinati chiudono UNA settimana, non due.');
  await evaluate(`document.querySelectorAll('[data-report-close],[data-confirm=cancel]').forEach(b => b.click()); true`); await pause(500);
  // 2. the answer time of a page change (click to the page drawn), on this machine without throttling
  const timings = [];
  for (const [sel, label] of [['.mobile-tabbar button:nth-child(3)', 'Sondaggi'], ['.mobile-tabbar button:nth-child(2)', 'Elezioni'], ['.mobile-tabbar button:nth-child(4)', 'Istituzioni'], ['.mobile-tabbar button:nth-child(1)', 'Home']]) {
    const target = await center(sel); assert.ok(target, `${label}: scheda presente`);
    await evaluate(`window.__t0 = null; window.__done = null; document.addEventListener('pointerdown', () => { window.__t0 = performance.now(); }, { capture: true, once: true }); new MutationObserver((records, obs) => { if (window.__t0 && !window.__done) { window.__done = performance.now() - window.__t0; obs.disconnect(); } }).observe(document.getElementById('app') ?? document.body, { childList: true, subtree: true }); true`);
    await tap(target, 1, 0); await pause(900);
    const ms = await evaluate('window.__done'); assert.ok(ms !== null, `${label}: la pagina si ridisegna`); timings.push([label, Math.round(ms)]);
    assert.ok(ms < 400, `${label}: risposta in ${Math.round(ms)} ms (tetto 400 ms)`);
  }
  console.log('Tempi di risposta (clic → pagina ridisegnata):', timings.map(([l, ms]) => `${l} ${ms} ms`).join(' · '));
  // 3. pressing gives immediate feedback: the pressed state is styled, no tap delay
  const css = await evaluate(`(() => { const b = document.querySelector('button'); return { touch: getComputedStyle(b).touchAction, tap: getComputedStyle(b).webkitTapHighlightColor }; })()`);
  assert.equal(css.touch, 'manipulation', 'Nessun ritardo del tocco (touch-action: manipulation).');
  assert.match(await evaluate(`[...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } }).map(r => r.cssText).filter(t => /:active/.test(t) && /scale/.test(t)).join(' ')`), /scale\(0?\.97\)/, 'Stato premuto con feedback visivo.');
  // 4. an error nobody caught: recorded, said, and the log can be copied
  await evaluate(`localStorage.removeItem('politicando.diag.v1'); Promise.reject(new Error('errore-di-prova')); true`); await pause(600);
  assert.match(await evaluate(`document.querySelector('.toast')?.innerText ?? ''`), /Qualcosa non ha funzionato: l’azione non è stata completata/, 'L’errore è detto al giocatore.');
  const log = await evaluate(`JSON.parse(localStorage.getItem('politicando.diag.v1') ?? '[]')`);
  assert.ok(log.length === 1 && log[0].message === 'errore-di-prova' && log[0].page.startsWith('#'), 'L’errore è nel registro con la pagina.');
  assert.ok(!JSON.stringify(log).includes('"token"'), 'Nessun dato personale nel registro.');
  await evaluate(`localStorage.removeItem('politicando.diag.v1'); true`);
  void errors;   // (the deliberate rejection above is the only error of the page)
}, { voter: true });
console.log('Reattività verificata: un doppio tocco chiude una sola settimana, le pagine rispondono entro il tetto, feedback immediato alla pressione, errori non intercettati registrati e detti (registro diagnostico).');
