// The horizontal menus keep their scroll position and the selected tab stays visible after a section change and every redraw (phone width, real Chrome).
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.log('Menu orizzontali: saltato (Chrome non disponibile).'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, send, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  await openCareer({ evaluate, goto, waitFor: wait });
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'off' })); location.hash = '#elezioni'; true`); await pause(1500);
  const state = () => evaluate(`(() => { const nav = document.querySelector('.sx-tabs'); if (!nav) return null; const tabs = [...nav.querySelectorAll('[role="tab"]')]; const active = nav.querySelector('.active'); const a = active?.getBoundingClientRect(), n = nav.getBoundingClientRect(); return { scrollable: nav.scrollWidth > nav.clientWidth + 2, left: Math.round(nav.scrollLeft), tabs: tabs.length, active: active?.textContent.trim().slice(0, 20) ?? null, visible: Boolean(a) && a.left >= n.left - 1 && a.right <= n.right + 1 }; })()`);
  const before = await state(); assert.ok(before, 'Le schede della Centrale elettorale ci sono.');
  if (!before.scrollable) { console.log(`Menu orizzontali: le schede entrano a 375 px senza scorrere (${before.tabs} schede): nulla da conservare qui.`); return; }
  // scroll to the end and select the LAST tab: after the redraw the strip must not jump back to the start and the tab must be visible
  await evaluate(`(() => { const nav = document.querySelector('.sx-tabs'); nav.scrollLeft = nav.scrollWidth; return true; })()`); await pause(150);
  await evaluate(`(() => { const tabs = [...document.querySelectorAll('.sx-tabs [role="tab"]')]; tabs.at(-1).click(); return true; })()`); await pause(700);
  const after = await state();
  assert.ok(after.left > 0, `Dopo il cambio di scheda la barra non torna all’inizio (scrollLeft ${after.left}).`);
  assert.ok(after.visible, `La scheda selezionata (${after.active}) resta visibile.`);
  // a redraw without a tab change (any state change) keeps it too
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.navigate('elezioni'); return true; })()`); await pause(500);
  const again = await state(); assert.ok(again.left === after.left || Math.abs(again.left - after.left) < 3, `Un ridisegno non sposta la barra (${after.left} → ${again.left}).`); assert.ok(again.visible);
  console.log(`Menu orizzontali: scrollLeft conservato (${before.left} → ${after.left}) e scheda «${after.active}» visibile, anche dopo un ridisegno.`);
});
