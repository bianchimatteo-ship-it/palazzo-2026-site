// The Quirinale is a section of its own among the institutions (Istituzioni → Quirinale, next to Governo), not only a tab of the electoral centre: it has its address (#quirinale), its place in the
// navigation on a computer and on a phone, the same content as before (renderQuirinale and the presidency engine are untouched), and the Elezioni tab keeps the election of the President with a pointer
// to the new section. Chrome, 1280 and 390 px. Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Sezione Quirinale saltata: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }

await withBrowser(async browser => {
  const { evaluate, viewport, waitFor, pause, goto, errors } = browser;
  await createCareerInPage(browser, { party: 'party-registro-p1-2017-41-ir', group: 'cam-xix-03', level: 'deputato', weeks: 2 });
  const heading = () => evaluate(`(document.querySelector('.page-wrap h1')?.textContent ?? '').trim().replace(/\\.$/, '')`);
  const click = selector => evaluate(`(async () => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) return false; element.click(); await new Promise(resolve => setTimeout(resolve, 800)); return true; })()`);

  // ---------- a computer ----------
  await viewport(1280, 800, false);
  await openCareer(browser);
  await evaluate(`document.querySelector('[data-nav="istituzioni"], [data-nav="parlamento"]')?.click(), true`); await pause(500);
  const entries = await evaluate(`[...document.querySelectorAll('.sidebar [data-nav], nav [data-nav]')].map(item => item.dataset.nav)`);
  assert.ok(entries.includes('quirinale'), `Il Quirinale è nel menu (${[...new Set(entries)].join(', ')}).`);
  const order = [...new Set(entries)].filter(id => ['parlamento', 'governo', 'quirinale', 'leggi'].includes(id));
  assert.deepEqual(order, ['parlamento', 'governo', 'quirinale', 'leggi'], 'Tra Governo e Leggi, allo stesso livello.');
  assert.ok(await click('[data-nav="quirinale"]'), 'Si apre dal menu.');
  await waitFor(() => evaluate(`document.body.textContent.includes('IL QUIRINALE')`), 15000);
  assert.equal(await heading(), 'Quirinale', 'La pagina ha il suo titolo.');
  assert.equal(await evaluate(`location.hash`), '#quirinale', 'E il suo indirizzo.');
  const content = await evaluate(`document.querySelector('.page-wrap').textContent`);
  for (const text of ['IL QUIRINALE', 'Come funziona', 'Presidente']) assert.ok(content.includes(text) || content.toLowerCase().includes(text.toLowerCase()), `La pagina dice «${text}».`);
  assert.ok(!/undefined|NaN|\[object Object\]/.test(content), 'Senza valori non validi.');
  const current = await evaluate(`(() => { const items = [...document.querySelectorAll('[data-nav="quirinale"]')]; return items.map(item => ({ cls: item.className, aria: item.getAttribute('aria-current'), parent: item.parentElement?.className ?? '' })); })()`);
  assert.ok(current.some(item => /nav-sub-item/.test(item.cls) && /\bactive\b/.test(item.cls)) && current.some(item => item.aria === 'page'), `La voce del menu è quella attiva (${JSON.stringify(current)}).`);

  // the address opens it directly, also after a reload
  await goto('#quirinale');
  await waitFor(() => evaluate(`Boolean(document.querySelector('[data-menu=continua]')) || Boolean(document.querySelector('.page-wrap'))`));
  if (await evaluate(`Boolean(document.querySelector('[data-menu=continua]'))`)) { await evaluate(`document.querySelector('[data-menu=continua]').click(), true`); await waitFor(() => evaluate(`Boolean(document.querySelector('.page-wrap'))`)); }
  await evaluate(`location.hash = '#quirinale', true`); await pause(900);
  assert.equal(await heading(), 'Quirinale', 'Dall’indirizzo si arriva alla sezione.');

  // ---------- the electoral centre keeps the election of the President, with a pointer ----------
  assert.ok(await click('[data-nav="elezioni"]'), 'La Centrale elettorale si apre.');
  await pause(500);
  assert.ok(await click('[data-section-tab="elezioni"][data-section-tab-value="quirinale"]'), 'La scheda Quirinale della Centrale elettorale c’è ancora.');
  await pause(700);
  const tab = await evaluate(`document.querySelector('.quirinale-pointer')?.textContent ?? ''`);
  assert.match(tab, /sezione propria/, `La scheda rimanda alla sezione (${tab}).`);
  assert.ok(await click('.quirinale-pointer [data-nav="quirinale"]'), 'Il rimando porta alla sezione.');
  await pause(700);
  assert.equal(await heading(), 'Quirinale');

  // ---------- a phone ----------
  await viewport(390, 844, true);
  await pause(500);
  await evaluate(`document.querySelector('[data-nav="parlamento"]')?.click(), true`); await pause(700);
  const phoneEntry = await evaluate(`(() => { const items = [...document.querySelectorAll('[data-nav="quirinale"]')].filter(item => { const box = item.getBoundingClientRect(); return box.width > 0 && box.height > 0; }); return items.length ? { count: items.length, height: Math.round(items[0].getBoundingClientRect().height) } : null; })()`);
  assert.ok(phoneEntry, 'Sul telefono la voce Quirinale è raggiungibile dalle Istituzioni.');
  assert.ok(await click('[data-nav="quirinale"]'), 'Si apre anche dal telefono.');
  await waitFor(() => evaluate(`document.body.textContent.includes('IL QUIRINALE')`), 15000);
  const phone = await evaluate(`({ overflow: document.documentElement.scrollWidth - window.innerWidth, title: (document.querySelector('.page-wrap h1')?.textContent ?? '').trim().replace(/\\.$/, ''), wide: [...document.querySelectorAll('.page-wrap *')].filter(item => item.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(item).position !== 'fixed' && !item.closest('.sx-table-wrap, .table-scroll, [data-scroll-x], pre')).length })`);
  assert.equal(phone.title, 'Quirinale');
  assert.ok(phone.overflow <= 1, `A 390 px nessuno scroll orizzontale (${phone.overflow}).`);
  assert.equal(phone.wide, 0, 'Nessun elemento esce dallo schermo.');
  assert.deepEqual(errors, [], `Errori in pagina: ${errors.slice(0, 2).join(' | ')}`);
  console.log('Sezione Quirinale verificata in Chrome: voce nel menu tra Governo e Leggi, pagina con titolo e indirizzo propri (anche aprendo direttamente #quirinale), stesso contenuto di prima, la scheda della Centrale elettorale rimanda alla sezione, raggiungibile dal telefono a 390 px senza scroll orizzontale.');
}, {});
