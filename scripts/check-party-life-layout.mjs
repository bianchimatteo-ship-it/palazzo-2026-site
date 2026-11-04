// «Vita interna → Operazioni sul partito» in Chrome a 320, 360, 390 px e su desktop: il menu di Restyling/Rilancio/Rifondazione e i campi della fondazione non superano mai la scheda; il menu mostra i nomi brevi, la descrizione dell'opzione scelta sta a parte e cambia con la scelta.
import assert from 'node:assert/strict';
import { withBrowser, createCareerInPage, openCareer, chromeAvailable } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Layout di Vita interna saltato: Chrome non trovato (imposta CHROME_PATH).'); process.exit(0); }
const results = [];
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, version }) => {
  await viewport(1280, 900, false);
  await createCareerInPage({ evaluate, version }, { level: 'deputato', weeks: 3, name: ['Anna', 'Bianchi'], region: 'Lombardia', extra: `
    const s = store.getState(); Object.assign(s.game.resources, { funds: 500000, politicalCapital: 99 });
    try { store.foundParty({ label: 'Rotta Nuova', abbreviation: 'RTN', followerIds: [] }); } catch (error) { for (let i = 0; i < 6; i++) { store.advance(7); Object.assign(store.getState().game.resources, { funds: 500000, politicalCapital: 99 }); try { store.foundParty({ label: 'Rotta Nuova', abbreviation: 'RTN', followerIds: [] }); break; } catch { /* wait */ } } }
    ` });
  await openCareer({ evaluate, goto, waitFor: wait }); await pause(1200);
  for (const [width, height, mobile] of [[320, 700, true], [360, 740, true], [390, 800, true], [1280, 900, false]]) {
    await viewport(width, height, mobile); await pause(300);
    await evaluate(`location.hash = '#partito'; true`); await pause(900);
    await evaluate(`(() => { const tab = [...document.querySelectorAll('[data-section-tab]')].find(b => b.dataset.sectionTabValue === 'vita'); tab?.click(); return true; })()`); await pause(700);
    await evaluate(`document.querySelectorAll('details').forEach(d => d.setAttribute('open', '')); true`); await pause(400);
    const report = await evaluate(`(() => {
      const ops = document.querySelector('.pl-ops'); if (!ops) return { missing: true };
      const out = [];
      for (const card of ops.querySelectorAll('.pl-op')) {
        const box = card.getBoundingClientRect();
        for (const el of card.querySelectorAll('select, input, textarea, label, .pl-form, .pl-rename-detail, .pl-found-form')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && (r.right > box.right + 1 || r.left < box.left - 1)) out.push(el.tagName + '.' + (el.className || el.name || '') + ' ' + Math.round(r.right - box.right));
        }
      }
      const select = document.querySelector('[data-rename-style]');
      const options = select ? [...select.options].map(o => o.textContent.trim()) : [];
      return { overflow: out, page: document.documentElement.scrollWidth - window.innerWidth, options, visible: [...document.querySelectorAll('[data-rename-detail]')].filter(p => !p.hidden).map(p => p.dataset.renameDetail) };
    })()`);
    assert.ok(!report.missing, `${width}px: le operazioni sul partito sono visibili`);
    assert.deepEqual(report.overflow, [], `${width}px: nessun campo supera la scheda (${report.overflow.join(', ')})`);
    assert.ok(report.page <= 1, `${width}px: nessuno scorrimento orizzontale della pagina (${report.page}px)`);
    assert.deepEqual(report.options, ['Restyling', 'Rilancio', 'Rifondazione'], `${width}px: il menu mostra solo i nomi brevi`);
    assert.deepEqual(report.visible, ['rilancio'], `${width}px: la descrizione dell'opzione scelta è mostrata a parte`);
    await evaluate(`(() => { const s = document.querySelector('[data-rename-style]'); s.value = 'rifondazione'; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await pause(200);
    const after = await evaluate(`[...document.querySelectorAll('[data-rename-detail]')].filter(p => !p.hidden).map(p => p.dataset.renameDetail)`);
    assert.deepEqual(after, ['rifondazione'], `${width}px: cambiando opzione cambia la descrizione`);
    results.push(width);
  }
});
console.log(`Vita interna: menu e campi senza overflow a ${results.join(', ')} px, nomi brevi nel menu e descrizione separata.`);
