// The table of the party's agreements in a real browser: title, counterpart, conditions and what is given back are four separate columns; the «Denuncia» button keeps its room and its text on one line
// (never squeezed, never broken letter by letter); nothing makes the page scroll sideways, from the phone to the desktop; the cards of the page are told apart by category with the tokens of the game
// (the page stays neutral: no party colour); and the actions of the agreements are the same as before.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Tabella degli accordi saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
  const extra = `
    const s = store.getState();
    const life = s.game.party.life ?? (store.partyLife?.(), s.game.party.life);
    const current = s.game.party.currents[0], other = s.game.party.currents[1] ?? current;
    s.game.party.life.pacts = [
      { id: 'accordo-1', kind: 'tregua', title: 'Tregua con l’area più grande del partito e tutto ciò che comporta', actorId: current.id, status: 'attivo', since: 3, until: s.game.week.index + 20, breaches: 0, renewals: 1, terms: { conflictId: null }, requestId: 'r1' },
      { id: 'accordo-2', kind: 'fondi', title: 'Fondi ai territori', actorId: other.id, status: 'attivo', since: 2, until: s.game.week.index + 9, breaches: 0, renewals: 0, terms: { amount: 1500 }, nextPayWeek: s.game.week.index + 4, requestId: 'r2' },
      { id: 'accordo-3', kind: 'tregua', title: 'Vecchia tregua', actorId: other.id, status: 'rotto', since: 1, until: 5, endedWeek: 5, breaches: 1, renewals: 0, terms: {}, requestId: 'r3' }
    ];
    store.save();`;
  await createCareerInPage({ evaluate, version }, { level: 'comunale', weeks: 6, extra });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`(async () => { document.querySelector('[data-nav="partito"]')?.click(); await new Promise(r => setTimeout(r, 500)); document.querySelector('[data-section-tab="partito"][data-section-tab-value="vita"]')?.click(); await new Promise(r => setTimeout(r, 800)); return true; })()`);
  await wait(() => evaluate(`Boolean(document.querySelector('.pl-pacts .sx-table'))`), 20000);
  const measure = () => evaluate(`(() => {
    const table = document.querySelector('.pl-pacts .sx-table');
    const heads = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
    const buttons = [...table.querySelectorAll('[data-life-pact-break]')].map(b => { const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return { text: b.textContent.trim(), width: r.width, height: r.height, scroll: b.scrollWidth, client: b.clientWidth, line: parseFloat(cs.lineHeight) || 18, wrap: cs.whiteSpace }; });
    const wrap = document.querySelector('.pl-pacts .sx-table-wrap');
    const vw = document.documentElement.clientWidth;
    const bad = [...document.querySelectorAll('.pl-page *')].filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.right > vw + 1 || r.left < -1) && !el.closest('.sx-table-wrap'); }).length;
    const cell = [...table.querySelectorAll('tbody tr:first-child td')].map(td => ({ label: td.dataset.label, text: td.textContent.trim().slice(0, 40), h: td.getBoundingClientRect().height }));
    const cards = [...document.querySelectorAll('.pl-page .sx-card')].map(c => ({ cls: c.className, top: getComputedStyle(c).borderTopColor, width: getComputedStyle(c).borderTopWidth }));
    return { heads, buttons, tableOverflow: wrap ? wrap.scrollWidth > wrap.clientWidth + 1 : false, pageOverflow: document.documentElement.scrollWidth - vw, bad, cell, cards, rows: table.querySelectorAll('tbody tr').length };
  })()`);
  for (const [width, height, mobile] of [[1280, 800, false], [1024, 768, false], [768, 1024, true], [390, 844, true], [320, 640, true]]) {
    await viewport(width, height, mobile);
    await pause(500);
    const m = await measure();
    assert.equal(m.rows, 3, `${width}px: le tre righe degli accordi.`);
    if (width >= 761) assert.deepEqual(m.heads.filter(Boolean), ['Accordo', 'Interlocutore', 'Condizioni', 'Contropartite', 'Durata', 'Stato'], `${width}px: titolo, interlocutore, condizioni e contropartite sono colonne separate.`);
    assert.equal(m.buttons.length, 2, `${width}px: «Denuncia» solo sugli accordi in vigore.`);
    for (const b of m.buttons) {
      assert.equal(b.text.replace(/\s+/g, ' '), 'Denuncia', `${width}px: il testo del pulsante.`);
      assert.ok(b.scroll <= b.client + 1, `${width}px: il testo del pulsante sta nel pulsante (${b.scroll} > ${b.client}).`);
      assert.ok(b.height < b.line * 2.6, `${width}px: «Denuncia» su una riga (altezza ${b.height}, riga ${b.line}).`);
      assert.ok(b.width >= 80, `${width}px: il pulsante non è schiacciato (${b.width}px).`);
    }
    assert.ok(m.pageOverflow <= 1 && m.bad === 0, `${width}px: la pagina non scorre di lato (${m.pageOverflow}px, ${m.bad} elementi fuori).`);
    assert.ok(m.cell.every(item => item.h < 420), `${width}px: nessuna cella enorme per colpa di testo spezzato a lettere.`);
  }
  // the page tells its categories apart with tokens, and keeps the actions
  await viewport(1280, 800, false);
  await pause(400);
  const m = await measure();
  const tops = new Set(m.cards.map(card => card.top));
  assert.ok(tops.size >= 4, `Le schede della pagina hanno colori di categoria diversi (${tops.size}).`);
  assert.ok(m.cards.every(card => parseFloat(card.width) >= 3), 'Ogni scheda ha il suo filo in alto.');
  // «Denuncia» still asks for confirmation (the action is the same as before)
  await evaluate(`document.querySelector('[data-life-pact-break="accordo-1"]').click(), true`);
  await wait(() => evaluate(`Boolean(document.querySelector('[data-confirm]'))`), 8000);
  await evaluate(`document.querySelector('[data-confirm="cancel"]').click(), true`);
  assert.deepEqual(errors, [], 'Nessun errore in pagina.');
});
console.log('Tabella degli accordi verificata in Chrome (1280, 1024, 768, 390 e 320 px): colonne separate, «Denuncia» su una riga e mai schiacciato, nessuno scorrimento laterale; schede della Vita interna distinte per categoria; la denuncia chiede ancora conferma.');
