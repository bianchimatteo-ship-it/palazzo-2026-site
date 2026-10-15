// Governo and Leggi, compact and readable on a phone (a Prime Minister's career, Chrome, 320–1280 px; skipped without Chrome):
//   Governo: the Government at a glance comes first (who leads, stability with its state, polls, the majority's mood, the accord, the agenda, the next deadline) and every state has a word and a glyph beside its
//   colour; the long forms (programme, majority, cabinet, new measure, budget law, public works, coalition accord) are folds that remember how the player left them, and show their cost or state in the
//   summary; a commitment of the accord is readable (its lines are separate, not run together); the same party in the two Chambers is told apart; the page is a fraction of what it was;
//   Leggi: a compact header, the proposal form folded under its cost, bills with title, sponsor, steps, next passage and effects in view and the rest (text, forecast, actions, votes) folded;
//   no horizontal scroll and no text under 12 px at the eight widths.
import assert from 'node:assert/strict';
import { chromeAvailable, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Layout di Governo e Leggi saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }

const WIDTHS = [[320, 640], [360, 800], [375, 812], [390, 844], [430, 932], [768, 1024], [1024, 768], [1280, 800]];
await withBrowser(async browser => {
  const { evaluate, version, pause, viewport, waitFor, errors } = browser;
  await evaluate(`(async () => {
    localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true }));
    const { store } = await import('/src/core/store.js?v=${version}');
    const real = await import('/src/data/repositories/real-data.js?v=${version}');
    await real.loadRealDatabase();
    await real.loadRealCollections(['parties', 'politicalMovements', 'parliamentaryGroups']);
    const party = real.realDatabase.parties.find(item => item.id === 'party-futuro-nazionale');
    store.createCareer({ firstName: 'Anna', lastName: 'Premier', birthDate: '1975-05-05', gender: 'donna', region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', provinceCode: '052', provinceName: 'Siena', provinceType: 'Provincia', previousProfession: 'Avvocata', initialLevel: 'deputato', partyMode: 'existing', partyId: party.id, parliamentStartMode: 'real-context', parliamentaryGroupId: 'cam-xix-12', startingOffice: 'presidenteConsiglio', startingRole: 'militante', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } }, real.realDatabase.parties, real.realDatabase.parliamentaryGroups);
    for (let i = 0; i < 3; i++) store.advanceTurn(1);
    return true; })()`);
  await openCareer(browser);
  const go = async page => { await evaluate(`document.querySelector('[data-nav="${page}"]')?.click(), true`); await pause(1100); };
  const view = () => evaluate(`(() => {
    const root = document.querySelector('.page-wrap');
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      wide: [...root.querySelectorAll('*')].filter(el => (el.checkVisibility ? el.checkVisibility() : true)).filter(el => { const r = el.getBoundingClientRect(); return r.right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('.table-scroll, .sx-table-wrap, [data-scroll-x], pre, [class*="subnav"]'); }).length,
      small: [...root.querySelectorAll('*')].filter(el => (el.checkVisibility ? el.checkVisibility() : true)).filter(el => el.children.length === 0 && el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 12 && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0).length,
      height: document.documentElement.scrollHeight,
      bad: /undefined|NaN|\\[object Object\\]/.test(root.textContent)
    };
  })()`);

  // ---------- Governo ----------
  await viewport(390, 844, true); await pause(300);
  await go('governo');
  assert.equal(await evaluate(`(document.querySelector('.page-wrap h1')?.textContent ?? '').trim().replace(/\\.$/, '')`), 'Governo');
  const glance = await evaluate(`(() => { const el = document.querySelector('.gov-glance'); if (!el) return null; const cells = [...el.querySelectorAll('.gov-glance-cell')].map(cell => ({ label: cell.querySelector('small').textContent.trim(), value: cell.querySelector('strong').textContent.trim(), badges: [...cell.querySelectorAll('.state-badge')].map(b => ({ text: b.textContent.trim(), glyph: Boolean(b.querySelector('svg')), cls: b.className })) })); const top = el.getBoundingClientRect().top; const first = document.querySelector('.government-current, details.pm-fold')?.getBoundingClientRect().top; return { cells, aboveForms: first === undefined || top < first }; })()`);
  assert.ok(glance, 'Il Governo in breve c’è.');
  assert.ok(glance.aboveForms, 'Ed è prima dei moduli.');
  const labels = glance.cells.map(cell => cell.label);
  for (const label of ['Presidenza del Consiglio', 'Stabilità', 'Maggioranza', 'Agenda', 'Scadenze']) assert.ok(labels.includes(label), `«${label}» è nel riepilogo (${labels.join(', ')}).`);
  assert.equal(glance.cells.find(cell => cell.label === 'Presidenza del Consiglio').value, 'Sei tu', 'Il giocatore è il Presidente del Consiglio.');
  assert.ok(glance.cells.filter(cell => cell.badges.length).every(cell => cell.badges.every(badge => badge.glyph && badge.text.length > 2)), 'Ogni stato ha un glifo e una parola, mai il solo colore.');
  assert.ok(glance.cells.some(cell => cell.badges.some(badge => /state-maggioranza|state-opposizione/.test(badge.cls))), 'Maggioranza (o opposizione) ha il suo colore e la sua icona.');
  assert.ok(glance.cells.every(cell => !/undefined|NaN/.test(cell.value)), 'Senza valori non validi.');

  const folds = await evaluate(`[...document.querySelectorAll('details.pm-fold')].map(d => ({ key: d.dataset.remember, open: d.open, summary: d.querySelector('summary').textContent.replace(/\\s+/g, ' ').trim() }))`);
  const keys = folds.map(fold => fold.key);
  for (const key of ['gov-program', 'gov-majority', 'gov-cabinet', 'gov-measure', 'gov-budget', 'gov-accord']) assert.ok(keys.includes(key), `Il blocco «${key}» è comprimibile (${keys.join(', ')}).`);
  assert.ok(folds.every(fold => !fold.open), 'Appena aperta la pagina i moduli lunghi sono chiusi.');
  assert.ok(/giorno.*cap\./.test(folds.find(fold => fold.key === 'gov-program').summary), 'Il programma dice già il costo (giorni e capitale politico).');
  assert.ok(/disegno di legge \d+ giorni · \d+ cap\..*decreto/.test(folds.find(fold => fold.key === 'gov-measure').summary), 'Il provvedimento dice i costi di legge e decreto.');
  assert.ok(/31 dicembre|approvata|esame/.test(folds.find(fold => fold.key === 'gov-budget').summary), 'La manovra dice a che punto è.');
  assert.ok(/impegni/.test(folds.find(fold => fold.key === 'gov-accord').summary), 'L’accordo dice quanti impegni ha.');
  const phone = await view();
  assert.ok(phone.height < 9000, `A 390 px la pagina Governo non è più un muro (${phone.height} px, prima 19.000).`);
  assert.ok(!phone.bad && phone.overflow <= 1 && phone.wide === 0, `Governo a 390 px senza valori non validi né scroll orizzontale (${JSON.stringify(phone)}).`);

  // a fold opens, shows its content, and is remembered after a reload
  await evaluate(`(() => { const d = document.querySelector('details[data-remember="gov-majority"]'); d.open = true; d.dispatchEvent(new Event('toggle')); return true; })()`);
  const majority = await evaluate(`(() => { const d = document.querySelector('details[data-remember="gov-majority"]'); const rows = [...d.querySelectorAll('.partner-row')].map(row => ({ title: row.querySelector('strong').textContent.trim(), badge: row.querySelector('.state-badge')?.textContent.trim() ?? '' })); return { rows, summit: Boolean(d.querySelector('[data-government-action="summit"]')) }; })()`);
  assert.ok(majority.rows.length >= 2, `La maggioranza elenca i suoi gruppi (${majority.rows.length}).`);
  assert.ok(majority.rows.every(row => row.badge.length > 2), 'Ogni alleato ha il suo stato in parole.');
  assert.ok(majority.rows.every(row => /· (Camera|Senato)$/.test(row.title)), `Lo stesso partito in Camera e Senato si distingue (${majority.rows.map(row => row.title).slice(0, 3).join(' | ')}).`);
  assert.ok(majority.summit, 'E offre il vertice con il suo costo.');
  // the accord: commitments with separate lines
  await evaluate(`(() => { const d = document.querySelector('details[data-remember="gov-accord"]'); d.open = true; return true; })()`);
  const accord = await evaluate(`(() => { const row = document.querySelector('.accord-commitment'); if (!row) return null; const lines = [...row.querySelectorAll('small')].map(small => ({ display: getComputedStyle(small).display, text: small.textContent.trim() })); const strong = row.querySelector('strong'); return { lines, titleBox: strong.getBoundingClientRect().bottom, firstLineTop: row.querySelector('small')?.getBoundingClientRect().top ?? 0 }; })()`);
  assert.ok(accord && accord.lines.length >= 2, 'Un impegno ha più righe (tipo e peso, criterio).');
  assert.ok(accord.lines.every(line => line.display === 'block'), 'Le righe di un impegno stanno su righe diverse, non attaccate.');
  assert.ok(accord.firstLineTop >= accord.titleBox - 1, 'E sotto il titolo.');
  await evaluate(`document.querySelector('details[data-remember="gov-accord"]').dispatchEvent(new Event('toggle')), true`); await pause(300);
  // the open folds are remembered: another page and back, then a reload
  const stillOpen = () => evaluate(`['gov-majority', 'gov-accord'].map(key => document.querySelector('details[data-remember="' + key + '"]')?.open)`);
  await go('panoramica'); await go('governo');
  assert.deepEqual(await stillOpen(), [true, true], 'Cambiando pagina e tornando, i moduli aperti restano aperti.');
  await browser.goto(); await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))')); await evaluate('document.querySelector("[data-menu=continua]").click(), true'); await waitFor(() => evaluate('Boolean(document.querySelector(".page-wrap"))'));
  await go('governo');
  assert.deepEqual(await stillOpen(), [true, true], 'E dopo aver ricaricato la partita.');
  await evaluate(`for (const key of ['gov-majority', 'gov-accord']) { const d = document.querySelector('details[data-remember="' + key + '"]'); d.open = false; d.dispatchEvent(new Event('toggle')); } true`);

  for (const [width, height] of WIDTHS) {
    await viewport(width, height, width < 800); await pause(300);
    await go('governo');
    const result = await view();
    assert.ok(result.overflow <= 1 && result.wide === 0, `Governo a ${width}px: nessuno scroll orizzontale (${result.overflow}, ${result.wide} elementi fuori).`);
    assert.equal(result.small, 0, `Governo a ${width}px: testi di almeno 12 px.`);
    assert.ok(!result.bad, `Governo a ${width}px: senza valori non validi.`);
  }

  // ---------- Leggi ----------
  await viewport(390, 844, true); await pause(300);
  await go('leggi');
  const laws = await evaluate(`(() => { const folds = [...document.querySelectorAll('details.law-fold')].map(d => ({ key: d.dataset.remember, open: d.open, summary: d.querySelector('summary').textContent.replace(/\\s+/g, ' ').trim() })); const hero = document.querySelector('.parliament-mode-hero'); return { folds, hero: hero ? Math.round(hero.getBoundingClientRect().height) : null, heroCompact: hero?.classList.contains('is-compact') ?? false, bigIntro: [...document.querySelectorAll('.parliament-mode-hero h2')].length }; })()`);
  assert.ok(laws.heroCompact && laws.hero <= 140 && laws.bigIntro === 0, `L’intestazione è compatta (${laws.hero} px, senza titolo grande).`);
  const keysLaws = laws.folds.map(fold => fold.key);
  for (const key of ['leggi-nuova', 'leggi-mie', 'leggi-proposte', 'leggi-reali', 'leggi-cronologia']) assert.ok(keysLaws.includes(key), `Il blocco «${key}» c’è (${keysLaws.join(', ')}).`);
  assert.ok(!laws.folds.find(fold => fold.key === 'leggi-nuova').open, 'Il modulo «Scrivi una proposta» è chiuso…');
  assert.ok(/1 giorno/.test(laws.folds.find(fold => fold.key === 'leggi-nuova').summary), '…e dice il costo in giorni.');
  assert.ok(!laws.folds.find(fold => fold.key === 'leggi-reali').open, 'Le leggi reali (lunghe) sono chiuse.');
  const lawsPhone = await view();
  assert.ok(lawsPhone.height < 4500, `A 390 px la pagina Leggi è corta (${lawsPhone.height} px, prima 12.400).`);
  // the form still works when opened and shows the cost on its button
  await evaluate(`document.querySelector('details[data-remember="leggi-nuova"]').open = true, true`); await pause(300);
  assert.match(await evaluate(`document.querySelector('[data-law-proposal-form] button[type="submit"]')?.textContent ?? ''`), /Presenta la legge · 1 giorno/, 'Il pulsante dice il costo.');
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-law-proposal-form] [data-policy-preview]'))`), 'L’anteprima di costi ed effetti è nel modulo.');
  // the bills: the card in view has title, sponsor, steps, and a folded body
  await evaluate(`document.querySelector('details[data-remember="leggi-proposte"]').open = true, true`); await pause(300);
  const bills = await evaluate(`(() => [...document.querySelectorAll('.bill-card')].slice(0, 6).map(card => ({ title: Boolean(card.querySelector('h3')?.textContent.trim()), sponsor: Boolean(card.querySelector('.bill-sponsor')), steps: card.querySelectorAll('.bill-steps li').length, more: Boolean(card.querySelector('details.bill-more')), summaryInMore: Boolean(card.querySelector('details.bill-more .bill-summary')), summaryOutside: Boolean(card.querySelector(':scope > p')), height: Math.round(card.getBoundingClientRect().height) })))()`);
  if (bills.length) {
    assert.ok(bills.every(card => card.title && card.sponsor && card.steps >= 4), 'Ogni proposta mostra titolo, promotore e fasi dell’iter.');
    assert.ok(bills.every(card => card.more && card.summaryInMore && !card.summaryOutside), 'Il testo e il resto stanno nei dettagli.');
  }
  for (const [width, height] of WIDTHS) {
    await viewport(width, height, width < 800); await pause(300);
    await go('leggi');
    const result = await view();
    assert.ok(result.overflow <= 1 && result.wide === 0, `Leggi a ${width}px: nessuno scroll orizzontale (${result.overflow}, ${result.wide} elementi fuori).`);
    assert.equal(result.small, 0, `Leggi a ${width}px: testi di almeno 12 px.`);
    assert.ok(!result.bad, `Leggi a ${width}px: senza valori non validi.`);
  }
  assert.deepEqual(errors, [], `Errori in pagina: ${errors.slice(0, 2).join(' | ')}`);
  console.log(`Layout di Governo e Leggi verificato in Chrome (Presidente del Consiglio): Governo in breve in cima con stati in parole e icone (maggioranza, stabilità, accordo, scadenze), moduli lunghi chiusi e ricordati con costi o stato nel titolo, impegni dell’accordo su righe separate, gruppi di Camera e Senato distinti, pagina a 390 px di ${phone.height} px (era 19.000); Leggi con intestazione compatta, modulo di proposta chiuso con il costo, proposte con titolo, promotore e iter in vista e il resto nei dettagli, pagina di ${lawsPhone.height} px (era 12.400); otto larghezze da 320 a 1280 px senza scroll orizzontale né testi sotto i 12 px.`);
}, {});
