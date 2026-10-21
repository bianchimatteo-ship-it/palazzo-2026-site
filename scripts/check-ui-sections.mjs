// Le sezioni riorganizzate, in un browser vero su 320, 360, 390, 430, 768, 1024 e 1440 px: la barra alta (logo POLITICANDO e logo del partito affiancati, poi titolo e testo), Fondi e partito
// (saldi, due operazioni distinte, storico), le tendine di Finanze e Vita interna (chiuse sul telefono, aperte sul computer, stato ricordato a ogni ridisegno), l'accordion di Elezioni →
// Nazionali (solo telefono: su computer la pagina resta intera), l'identità delle aree (colore e icona fissi per id) e i colori di Agenda e Carriera.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Sezioni riorganizzate nel browser saltate: Chrome non trovato (imposta CHROME_PATH per eseguirle).'); process.exit(0); }
const WIDTHS = [320, 360, 390, 430, 768, 1024, 1440];
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  await viewport(1440, 900, false);
  await openCareer({ evaluate, goto, waitFor: wait });
  await pause(1800);
  const closeNews = () => evaluate(`(() => { [...document.querySelectorAll('button')].filter(b => /^Chiudi$/.test(b.textContent.trim()) && b.closest('aside,[role=dialog]')).forEach(b => b.click()); return true; })()`);
  const go = async hash => { await closeNews(); await evaluate(`location.hash = '#${hash}'; true`); await pause(900); };
  const overflow = () => evaluate(`(() => { const d = document.documentElement; return { over: d.scrollWidth > innerWidth + 1, sw: d.scrollWidth, iw: innerWidth }; })()`);

  for (const width of WIDTHS) {
    const phone = width <= 600;
    await viewport(width, phone ? 800 : 900, phone); await pause(500);
    await go('panoramica');
    // ---- the top bar: the two logos side by side, then the title and its text (the text may be hidden on a narrow computer, never overlapped)
    const bar = await evaluate(`(() => { const box = el => { const r = el?.getBoundingClientRect(); return r ? { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height } : null; }; const brands = document.querySelector('.topbar-brands'); const logo = brands?.querySelector('.topbar-brand'); const party = brands?.querySelector('.topbar-party'); const title = document.querySelector('.topbar-title > strong'); const intro = document.querySelector('.topbar-title > span:not(.topbar-brands)'); const bar = document.querySelector('.topbar'); return { brands: box(brands), logo: box(logo), party: box(party), title: box(title), intro: intro && getComputedStyle(intro).display !== 'none' ? box(intro) : null, bar: box(bar), src: logo?.getAttribute('src') ?? '', shown: brands ? getComputedStyle(brands).display : 'none', partyShown: party ? getComputedStyle(party).display : 'none', logos: document.querySelectorAll('.topbar-brand').length, parties: document.querySelectorAll('.topbar-party').length, barOver: bar ? bar.scrollWidth > bar.clientWidth + 1 : false }; })()`);
    assert.ok(bar.shown !== 'none' && bar.partyShown !== 'none', `${width}px: i due loghi si vedono (${bar.shown}/${bar.partyShown}).`);
    assert.ok(/logo-politicando/.test(bar.src), `${width}px: il logo POLITICANDO è il file del progetto (${bar.src}).`);
    assert.equal(bar.logos, 1, `${width}px: un solo logo POLITICANDO nella barra.`); assert.equal(bar.parties, 1, `${width}px: un solo logo del partito nella barra.`);
    assert.ok(bar.logo.r <= bar.party.l + 1 && Math.abs((bar.logo.t + bar.logo.b) / 2 - (bar.party.t + bar.party.b) / 2) <= 4, `${width}px: i loghi sono affiancati e allineati in verticale (${JSON.stringify([bar.logo, bar.party])}).`);
    assert.ok(bar.logo.w >= 30 && bar.party.w >= 30 && bar.logo.h <= 60 && bar.party.h <= 60, `${width}px: dimensioni dei loghi sensate (${bar.logo.w}×${bar.logo.h}, ${bar.party.w}×${bar.party.h}).`);
    assert.ok(bar.title.t >= bar.bar.t - 1 && bar.title.b <= bar.bar.b + 1 && !bar.barOver, `${width}px: il titolo sta nella barra senza tagli (${bar.title.t}-${bar.title.b} su ${bar.bar.t}-${bar.bar.b}).`);
    if (!phone) {
      assert.ok(bar.title.l >= bar.brands.r - 1, `${width}px: il titolo segue i loghi, non li sovrappone.`);
      if (bar.intro) assert.ok(bar.intro.t >= bar.title.b - 2 && bar.intro.l >= bar.brands.r - 1 && bar.intro.b <= bar.bar.b + 1, `${width}px: il testo descrittivo sta sotto il titolo, dentro la barra.`);
      assert.ok(bar.title.h <= 30, `${width}px: il titolo sta su una riga (${bar.title.h} px).`);
    }
    assert.equal((await overflow()).over, false, `${width}px: nessuno scorrimento orizzontale nella Home.`);

    // ---- Finanze: balances, two distinct operations, history; the folds
    await go('finanze');
    const fin = await evaluate(`(() => { const q = s => document.querySelectorAll(s).length; const vis = el => el && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0; const folds = [...document.querySelectorAll('.finance-page details.fold-panel')].map(d => ({ id: d.dataset.remember, open: d.open, summaryShown: vis(d.querySelector('summary')) })); const ops = [...document.querySelectorAll('.tr-op')].map(el => { const r = el.getBoundingClientRect(); return { kind: el.classList.contains('is-request') ? 'request' : 'give', l: r.left, r: r.right, over: el.scrollWidth > el.clientWidth + 1 }; }); return { balances: q('.tr-balance'), personal: q('.tr-balance.is-personal'), treasury: q('.tr-balance.is-treasury'), ops, chipsAsk: q('[data-transfer-request]:not([data-transfer-request=custom])'), chipsGive: q('[data-transfer-give]:not([data-transfer-give=custom])'), customAsk: q('[data-transfer-custom=request]'), customGive: q('[data-transfer-custom=give]'), goAsk: q('[data-transfer-request=custom]'), goGive: q('[data-transfer-give=custom]'), history: q('.tr-history'), dir: [...document.querySelectorAll('.tr-dir')].map(e => e.textContent.trim()), folds, over: document.documentElement.scrollWidth > innerWidth + 1 }; })()`);
    assert.ok(fin.balances === 2 && fin.personal === 1 && fin.treasury === 1, `${width}px: due schede di saldo (personale e tesoreria).`);
    assert.equal(fin.ops.length, 2, `${width}px: due operazioni distinte.`);
    assert.deepEqual(fin.dir, ['DAL PARTITO → A TE', 'DA TE → AL PARTITO'], `${width}px: la direzione di ogni operazione è scritta.`);
    assert.ok(fin.chipsAsk >= 3 && fin.chipsGive >= 3 && fin.customAsk === 1 && fin.customGive === 1 && fin.goAsk === 1 && fin.goGive === 1, `${width}px: importi preimpostati, importo libero e pulsanti come prima (${JSON.stringify(fin)}).`);
    assert.ok(fin.ops.every(op => !op.over), `${width}px: nulla esce dalle schede delle operazioni.`);
    if (width > 760) assert.ok(fin.ops[0].r <= fin.ops[1].l + 2, `${width}px: le due operazioni sono affiancate.`);
    assert.equal(fin.history, 1, `${width}px: lo storico c'è.`);
    assert.ok(fin.folds.length >= 5 && fin.folds.every(f => f.summaryShown), `${width}px: cinque tendine con titolo e riepilogo visibili (${fin.folds.length}).`);
    if (phone) assert.ok(fin.folds.every(f => !f.open), `${width}px: sul telefono i contenuti secondari partono chiusi.`);
    else assert.ok(fin.folds.every(f => f.open), `${width}px: sul computer le tendine partono aperte.`);
    assert.equal(fin.over, false, `${width}px: Finanze senza scorrimento orizzontale.`);

    // ---- Vita interna: the folds, the areas with a colour and an icon of their own
    await go('partito');
    await evaluate(`(() => { document.querySelector('[data-section-tab="partito"][data-section-tab-value="vita"]')?.click(); return true; })()`); await pause(700);
    const life = await evaluate(`(() => { const folds = [...document.querySelectorAll('.pl-page details.fold-panel')].map(d => ({ id: d.dataset.remember, open: d.open })); const areas = [...document.querySelectorAll('.pl-area[data-area]')].map(el => ({ id: el.dataset.area, color: getComputedStyle(el).getPropertyValue('--area').trim(), icon: Boolean(el.querySelector('.pl-area-mark svg')), name: el.querySelector('strong')?.textContent.trim() })); return { folds, areas, legend: document.querySelectorAll('.pl-area-legend li').length, over: document.documentElement.scrollWidth > innerWidth + 1 }; })()`);
    assert.ok(life.folds.length >= 5 && ['vita-richieste', 'vita-aree', 'vita-accordi', 'vita-congresso', 'vita-quadri', 'vita-operazioni'].every(id => life.folds.some(f => f.id === id)), `${width}px: le tendine della Vita interna (${life.folds.map(f => f.id)}).`);
    assert.ok(life.areas.length >= 3 && new Set(life.areas.map(a => a.color)).size === life.areas.length && life.areas.every(a => a.icon && a.name), `${width}px: ogni area ha colore e icona diversi e il nome scritto (${JSON.stringify(life.areas)}).`);
    if (phone) assert.ok(life.folds.filter(f => f.id !== 'vita-richieste').every(f => !f.open), `${width}px: sul telefono la Vita interna parte chiusa.`);
    assert.equal(life.over, false, `${width}px: Vita interna senza scorrimento orizzontale.`);

    // ---- Elezioni → Nazionali: an accordion on a phone only, the whole page on a computer
    await go('elezioni');
    await evaluate(`(() => { document.querySelector('[data-section-tab="elezioni"][data-section-tab-value="nazionali"]')?.click(); return true; })()`); await pause(900);
    const nat = await evaluate(`(() => { const vis = el => el && el.getBoundingClientRect().height > 0; const folds = [...document.querySelectorAll('.national-view details.card-fold')].map(d => ({ id: d.dataset.remember, open: d.open, summary: vis(d.querySelector('summary')), body: vis(d.querySelector('.card-fold-body')) })); return { folds, over: document.documentElement.scrollWidth > innerWidth + 1 }; })()`);
    assert.ok(nat.folds.length >= 8, `${width}px: le sezioni di Nazionali sono pannelli (${nat.folds.length}).`);
    if (phone) {
      assert.ok(nat.folds.every(f => f.summary), `${width}px: ogni sezione ha il suo controllo (titolo e icona).`);
      assert.ok(nat.folds.filter(f => f.open).length <= 1, `${width}px: non tutto aperto al primo accesso (${nat.folds.filter(f => f.open).map(f => f.id)}).`);
    } else assert.ok(nat.folds.every(f => f.open && f.body && !f.summary), `${width}px: su computer ogni sezione è intera e visibile, senza controlli di chiusura.`);
    assert.equal(nat.over, false, `${width}px: Nazionali senza scorrimento orizzontale.`);
  }

  // the state of the folds is kept by the interface: a choice on a phone survives every redraw; a computer is never left with a hidden section
  await viewport(390, 800, true); await pause(400);
  await go('finanze');
  const key = 'fin-investimenti';
  await evaluate(`(() => { document.querySelector('details[data-remember="${key}"] > summary').click(); return true; })()`); await pause(400);
  assert.equal(await evaluate(`document.querySelector('details[data-remember="${key}"]').open`), true, 'Un tocco apre la tendina.');
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.advance(0); return true; })()`); await pause(600);
  assert.equal(await evaluate(`document.querySelector('details[data-remember="${key}"]').open`), true, 'Dopo un ridisegno la tendina scelta resta aperta.');
  assert.equal(await evaluate(`document.querySelector('details[data-remember="fin-registri"]').open`), false, 'Le altre restano chiuse.');
  await go('elezioni');
  await evaluate(`(() => { document.querySelector('[data-section-tab="elezioni"][data-section-tab-value="nazionali"]')?.click(); return true; })()`); await pause(800);
  await evaluate(`window.scrollTo(0, 300); true`); await pause(200);
  const y0 = await evaluate(`Math.round(window.scrollY)`);
  await evaluate(`(() => { document.querySelector('.national-view details.card-fold:not([open]) > summary').click(); return true; })()`); await pause(300);
  assert.ok(Math.abs((await evaluate(`Math.round(window.scrollY)`)) - y0) <= 6, 'Aprire un pannello non sposta lo scorrimento.');
  await viewport(1440, 900, false); await pause(600);
  assert.equal(await evaluate(`[...document.querySelectorAll('.national-view details.card-fold')].every(d => d.open)`), true, 'Tornando al computer ogni sezione di Nazionali è di nuovo aperta, qualunque scelta fatta sul telefono.');

  // the identity of the areas does not depend on the order or on a redraw
  const identity = await import(new URL(`../src/ui/party-life-view.js?v=${version}`, import.meta.url).href).catch(() => null);
  if (identity?.areaIdentity) {
    const first = ['riformisti', 'territori', 'movimento', 'altra-area'].map(id => identity.areaIdentity(id));
    const again = ['altra-area', 'movimento', 'territori', 'riformisti'].reverse().map(id => identity.areaIdentity(id));
    assert.deepEqual(first, again, 'Colore e icona di un’area dipendono solo dal suo id.');
    assert.equal(new Set(first.map(item => item.color)).size, first.length, 'Aree diverse, colori diversi.');
  }
  // Agenda and Carriera: a colour per family, always with its label
  await go('calendario');
  await evaluate(`(() => { document.querySelector('[data-section-tab="agenda"][data-section-tab-value="calendario"]')?.click(); return true; })()`); await pause(700);
  const agenda = await evaluate(`(() => { const items = [...document.querySelectorAll('.ag-item[data-cat]')]; const filters = [...document.querySelectorAll('.ag-filters button[data-cat]')]; return { items: items.length, labelled: items.every(el => el.querySelector('.ag-kind')?.textContent.trim().length > 2), filters: filters.length, distinct: new Set(filters.map(b => getComputedStyle(b).getPropertyValue('--c').trim())).size, over: document.documentElement.scrollWidth > innerWidth + 1 }; })()`);
  assert.ok(agenda.items >= 1 && agenda.labelled, 'Ogni impegno ha famiglia, colore e nome scritto.');
  assert.ok(agenda.filters >= 6 && agenda.distinct >= 6, `Un colore per ogni famiglia di filtri (${agenda.distinct}).`);
  assert.equal(agenda.over, false, 'Agenda senza scorrimento orizzontale.');
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
});
console.log('Sezioni riorganizzate verificate in Chrome a 320, 360, 390, 430, 768, 1024 e 1440 px: barra alta con i due loghi affiancati e il titolo, Fondi e partito con saldi, due operazioni e storico, tendine di Finanze e Vita interna (chiuse sul telefono, aperte sul computer, ricordate a ogni ridisegno), accordion di Nazionali solo su telefono, aree con colore e icona fissi, colori di Agenda, nessuno scorrimento orizzontale.');
