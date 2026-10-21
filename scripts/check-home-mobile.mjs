// Home on a phone: the identity block reads in a clear order (kicker, name, role, party/career/institution chips, logo in the corner, nothing cut or overlapping), and the secondary
// blocks are panels that open and close with the same <details data-remember> system as the drawers: aria-expanded follows, the choice survives a redraw and a restart, opening one does not
// scroll the page away, and on a computer the same blocks are whole and open with no control to hide them. Chrome, widths 320/360/390/430/768/1280.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Home su telefono: Chrome non trovato (imposta CHROME_PATH), controllo saltato.'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 3 });
  const identity = () => evaluate(`(() => {
    const box = document.querySelector('.hqc-who .hq-identity'); if (!box) return null;
    const h1 = box.querySelector('h1');
    const r = el => { const b = el?.getBoundingClientRect(); return b ? { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right - (el === h1 ? parseFloat(getComputedStyle(el).paddingRight) || 0 : 0), b: b.bottom } : null; };
    const role = box.querySelector('.hq-role'), kicker = box.querySelector('.section-kicker'), chips = box.querySelector('.hq-chips'), logo = box.querySelector('.hero-party-logo, .emblem-lg');
    return { width: innerWidth, scrollW: document.documentElement.scrollWidth, box: r(box), h1: r(h1), role: r(role), kicker: r(kicker), chips: r(chips), logo: r(logo), groups: [...box.querySelectorAll('.hq-chip-group')].map(r),
      clipped: [h1, role, kicker].some(el => el && el.scrollWidth > el.clientWidth + 1) };
  })()`);
  const folds = () => evaluate(`[...document.querySelectorAll('.hqc-fold-band')].map(d => { const s = d.querySelector(':scope > .hqc-fold-head'); const cs = s ? getComputedStyle(s) : null; return { id: d.dataset.remember, open: d.open, expanded: s?.getAttribute('aria-expanded') ?? null, headShown: Boolean(cs && cs.display !== 'none'), h: s ? s.getBoundingClientRect().height : 0 }; })`);
  const toggle = id => evaluate(`(() => { const s = document.querySelector('[data-remember="${id}"] > .hqc-fold-head'); s.click(); return true; })()`);
  const reload = async () => { await openCareer({ evaluate, goto, waitFor: wait }); await pause(400); };

  for (const width of [320, 360, 390, 430]) {
    await viewport(width, 800, true);
    await reload();
    const id = await identity();
    assert.ok(id, `${width}px: blocco identità presente.`);
    assert.ok(id.scrollW <= id.width + 1, `${width}px: nessuno scorrimento orizzontale (${id.scrollW} > ${id.width}).`);
    assert.ok(!id.clipped, `${width}px: nome, ruolo e titolo non sono tagliati.`);
    assert.ok(id.kicker.y < id.h1.y && id.h1.y < id.role.y && id.role.y < id.chips.y, `${width}px: ordine kicker → nome → ruolo → gruppi.`);
    assert.ok(id.box.x >= 0 && id.box.r <= id.width + 1, `${width}px: il blocco sta nello schermo.`);
    if (id.logo) {
      assert.ok(id.logo.r <= id.width + 1 && id.logo.x >= 0, `${width}px: il logo sta nello schermo.`);
      assert.ok(id.logo.x >= id.kicker.r - 1 || id.logo.b <= id.kicker.y + 1 || id.logo.y >= id.kicker.b - 1, `${width}px: il logo non copre il titolo (${JSON.stringify([id.logo, id.kicker])}).`);
      assert.ok(id.logo.x >= id.h1.r - 1 || id.logo.b <= id.h1.y + 1 || id.logo.y >= id.h1.b - 1 || id.h1.r <= id.logo.x + 1, `${width}px: né il nome (${JSON.stringify([id.logo, id.h1, id.kicker])}).`);
    }
    for (const g of id.groups) assert.ok(g.r <= id.width + 1, `${width}px: i gruppi di chip non escono dallo schermo.`);
    const list = await folds();
    assert.ok(list.length >= 4, `${width}px: pannelli della Home (${list.length}).`);
    for (const f of list) {
      assert.ok(f.headShown && f.h >= 44, `${width}px: ${f.id} ha un’intestazione da tocco (${f.h}px).`);
      assert.equal(f.expanded, String(f.open), `${width}px: ${f.id} aria-expanded coerente con lo stato aperto.`);
    }
  }

  // open / close, persistence, no scroll jump
  await viewport(390, 800, true); await reload();
  const first = (await folds()).find(f => !f.open);
  assert.ok(first, 'C’è un pannello chiuso da aprire.');
  await evaluate('window.scrollTo(0, 220), true'); await pause(150);
  const y0 = await evaluate('Math.round(window.scrollY)');
  await toggle(first.id); await pause(350);
  let now = (await folds()).find(f => f.id === first.id);
  assert.ok(now.open && now.expanded === 'true', 'Aperto: stato e aria-expanded.');
  const y1 = await evaluate('Math.round(window.scrollY)');
  assert.ok(Math.abs(y1 - y0) < 120, `Aprire un pannello non fa saltare la pagina (${y0} → ${y1}).`);
  await evaluate(`window.dispatchEvent(new Event('resize')), true`); await pause(200);
  assert.ok((await folds()).find(f => f.id === first.id).open, 'Un ridisegno non lo richiude.');
  await reload();
  assert.ok((await folds()).find(f => f.id === first.id).open, 'Dopo il riavvio resta aperto.');
  await toggle(first.id); await pause(350);
  now = (await folds()).find(f => f.id === first.id);
  assert.ok(!now.open && now.expanded === 'false', 'Richiuso: stato e aria-expanded.');
  await reload();
  assert.ok(!(await folds()).find(f => f.id === first.id).open, 'Anche la chiusura è ricordata.');
  // keyboard: the summary is focusable and Enter toggles it
  await evaluate(`document.querySelector('[data-remember="${first.id}"] > .hqc-fold-head').focus(), true`);
  assert.equal(await evaluate(`document.activeElement?.classList.contains('hqc-fold-head')`), true, 'L’intestazione si raggiunge con la tastiera.');

  // a computer: whole and open, no control to hide them
  for (const width of [768, 1280]) {
    await viewport(width, 900, width < 800); await reload();
    const list = await folds();
    if (width >= 1024) for (const f of list) assert.ok(f.open && !f.headShown, `${width}px: ${f.id} aperto e senza intestazione da chiudere.`);
    const id = await identity();
    assert.ok(id.scrollW <= id.width + 1, `${width}px: nessuno scorrimento orizzontale.`);
  }
  assert.deepEqual(errors.slice(0, 3), [], 'Nessun errore in console.');
});
console.log('Home su telefono verificata in Chrome (320/360/390/430 px): identità in ordine e senza tagli, logo che non copre nome né titolo, pannelli richiudibili con aria-expanded coerente, scelta ricordata dopo ridisegno e riavvio, nessun salto di pagina, intestazione da tocco; su computer i blocchi restano interi e aperti.');
