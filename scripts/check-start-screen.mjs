// The screen shown when the game opens, before a career is loaded (src/ui/menu.js: renderMainMenu), in a real browser (Chrome over the DevTools protocol; skipped when it is not
// installed). The order of the actions: starting a career first, resuming it second (only when there is one, with the logo and the colour of the party the career is in), then the
// careers already made (load, Hall of Fame, account), then help and options. Every button does what it says, saves are found, nothing is lost by opening the menu; the screen does
// not scroll sideways and is legible at 320, 375, 390, 430, 768, 1024 and 1280 px, with the two main actions on the first screen of a phone.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
import { legibilityAudit } from './lib/legibility.mjs';

if (!chromeAvailable) { console.log('Schermata iniziale saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).'); process.exit(0); }
const FN = 'party-futuro-nazionale';
const WIDTHS = [[320, 640], [375, 812], [390, 844], [430, 932], [768, 1024], [1024, 768], [1280, 800]];
const problems = [];
const check = (condition, message) => { if (!condition) problems.push(message); };

await withBrowser(async browser => {
  const { evaluate, viewport, goto, waitFor, pause, errors, version } = browser;
  const menu = () => evaluate(`(() => { const q = selector => document.querySelector(selector); const order = [...document.querySelectorAll('.menu-column [data-menu]')].map(el => el.dataset.menu); const card = q('.menu-continue'); const style = card ? getComputedStyle(card) : null; return { order, groups: [...document.querySelectorAll('.menu-group-title')].map(el => el.textContent.trim()), continueCard: card ? { text: card.textContent.replace(/\\s+/g, ' ').trim(), img: card.querySelector('img')?.getAttribute('src') ?? null, ghost: Boolean(card.querySelector('.emblem-ghost')), accent: style.getPropertyValue('--party-accent').trim(), mark: card.querySelector('.emblem')?.textContent.trim() ?? '' } : null, panel: q('.menu-panel')?.textContent.replace(/\\s+/g, ' ').trim().slice(0, 400) ?? '', facts: [...document.querySelectorAll('.menu-facts strong')].map(el => el.textContent.trim()), wizard: Boolean(q('.career-wizard')), home: Boolean(q('.page-wrap') && !q('.main-menu')) }; })()`);
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click(), true`); await pause(500); };

  const widthsPass = async label => {
    for (const [width, height] of WIDTHS) {
      await viewport(width, height);
      await goto();
      await waitFor(() => evaluate('Boolean(document.querySelector(".main-menu"))'));
      await pause(500);
      const audit = await evaluate(legibilityAudit('.menu-shell'));
      for (const issue of audit.issues) check(false, `${width}px ${label} · ${issue}`);
      const first = await evaluate(`(() => { const rect = selector => { const el = document.querySelector(selector); return el ? el.getBoundingClientRect() : null; }; const n = rect('.menu-new'), c = rect('.menu-continue'); return { newBottom: n?.bottom ?? null, continueBottom: c?.bottom ?? null, innerHeight, tops: [n?.top, c?.top] }; })()`);
      check(first.newBottom !== null && first.newBottom <= first.innerHeight, `${width}px ${label} · «Nuova partita» è nella prima schermata (${Math.round(first.newBottom)} px su ${first.innerHeight}).`);
      if (first.continueBottom !== null && width <= 430) check(first.continueBottom <= first.innerHeight, `${width}px ${label} · anche «Continua» è nella prima schermata (${Math.round(first.continueBottom)} px su ${first.innerHeight}).`);
      if (first.tops[1] !== null) check(first.tops[0] < first.tops[1], `${width}px ${label} · «Nuova partita» sta sopra «Continua».`);
    }
    await viewport(1280, 800);
  };

  // ---------- 1. no career yet: the opening screen of a first visit ----------
  await evaluate(`localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true }))`);
  await goto();
  await waitFor(() => evaluate('Boolean(document.querySelector(".main-menu"))'));
  await pause(500);
  let state = await menu();
  check(state.order[0] === 'nuova', `Senza carriera la prima azione è «Nuova partita» (ordine: ${state.order.join(', ')}).`);
  check(!state.order.includes('continua') && !state.continueCard, 'Senza carriera non c’è «Continua»: nessun pannello vuoto o finto.');
  check(JSON.stringify(state.order.slice(1)) === JSON.stringify(['carica', 'hall', 'account', 'guida', 'impostazioni']), `Poi le carriere già fatte e l’aiuto: ${state.order.slice(1).join(', ')}.`);
  check(state.groups.join('|') === 'Le tue carriere|Aiuto e opzioni', `Gruppi: ${state.groups.join(' | ')}.`);
  check(state.facts.length > 0 && state.facts.every(value => Number(value.replace(/\D/g, '')) > 0), `I numeri del gioco sono quelli dei dati caricati, mai zero o vuoti (${state.facts.join(', ')}).`);
  // every entry opens its own content as a dialog centred over the homepage (never a panel added under it), and it closes with its close button, «Annulla», Escape or a click on the backdrop
  const titles = { carica: 'Carica partita', hall: 'Hall of Fame', account: 'Account e salvataggi online', guida: 'Come giocare', impostazioni: 'Impostazioni' };
  const popup = () => evaluate(`(() => { const dialog = document.querySelector('.menu-popup'); if (!dialog) return null; const box = dialog.getBoundingClientRect(); const wrap = document.querySelector('.menu-popup-backdrop'); return { label: dialog.getAttribute('aria-label'), modal: dialog.getAttribute('aria-modal'), role: dialog.getAttribute('role'), centerX: Math.round(box.left + box.width / 2), centerY: Math.round(box.top + box.height / 2), width: innerWidth, height: innerHeight, fits: box.width <= innerWidth + 1 && box.height <= innerHeight + 1, scrolls: getComputedStyle(dialog.querySelector('.menu-popup-body')).overflowY, close: Boolean(dialog.querySelector('.menu-popup-x')), cancel: Boolean(dialog.querySelector('.menu-popup-foot [data-menu-close]')), backdrop: Boolean(wrap), text: dialog.textContent.replace(/\\s+/g, ' ').trim().slice(0, 200), homepage: Boolean(document.querySelector('.menu-column [data-menu=nuova]')), presentation: document.querySelector('.menu-panel')?.textContent.includes('La politica italiana, settimana dopo settimana') ?? false }; })()`);
  const escape = async () => { await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), true`); await pause(400); };
  const closers = {
    'il pulsante di chiusura': async () => click('.menu-popup-x'),
    '«Annulla»': async () => click('.menu-popup-foot [data-menu-close]'),
    'Escape': escape,
    'un clic sullo sfondo': async () => click('.menu-popup-backdrop')
  };
  for (const [id, title] of Object.entries(titles)) {
    await click(`[data-menu=${id}]`);
    const open = await popup();
    check(open && open.label === title && open.role === 'dialog' && open.modal === 'true', `«${title}» si apre in un popup accessibile (dialog modale con titolo): ${JSON.stringify(open && { label: open.label, role: open.role, modal: open.modal })}.`);
    check(open?.text.includes(title) || id === 'hall', `Il popup di «${title}» ha il suo contenuto (${open?.text.slice(0, 60)}).`);
    check(open?.close && open?.cancel && open?.backdrop, `Il popup di «${title}» ha chiusura visibile, «Annulla» e sfondo.`);
    check(open?.homepage && open?.presentation, `Sotto il popup di «${title}» la homepage resta, e il pannello non è sostituito.`);
    check(open && Math.abs(open.centerX - open.width / 2) <= 2 && (open.width <= 700 || Math.abs(open.centerY - open.height / 2) <= 4) && open.fits, `Il popup di «${title}» è centrato e sta nello schermo (${open?.centerX},${open?.centerY} su ${open?.width}×${open?.height}).`);
    check(open && ['auto', 'scroll'].includes(open.scrolls), `Il contenuto del popup di «${title}» scorre da sé.`);
    // a click inside the dialog does not close it
    await evaluate(`document.querySelector('.menu-popup-body')?.click(), true`); await pause(250);
    check(Boolean(await popup()), `Un clic dentro il popup di «${title}» non lo chiude.`);
    for (const [how, close] of Object.entries(closers)) {
      if (!(await popup())) await click(`[data-menu=${id}]`);
      await close();
      check((await popup()) === null, `«${title}» si chiude con ${how}.`);
    }
    state = await menu();
    check(state.panel.includes('La politica italiana, settimana dopo settimana') && !state.wizard && !state.home, `Chiuso «${title}» si torna alla homepage, senza avviare nulla.`);
  }
  await click('[data-menu=nuova]');
  state = await menu();
  check(state.wizard, '«Nuova partita» apre i passaggi della nuova carriera.');
  await click('[data-wizard-action=cancel]');
  state = await menu();
  check(!state.wizard && state.order[0] === 'nuova', 'Annullando i passaggi si torna all’apertura.');

  await widthsPass('senza carriera');

  // ---------- 2. a career of Futuro Nazionale: the logo and the colour of the party ----------
  await createCareerInPage(browser, { party: FN, group: 'cam-xix-12', weeks: 3 });
  const before = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const s = store.getState(); return { week: s.game.week.index, date: s.clock.currentDate, player: s.dataset.politicians.find(item => item.id === s.career.playerId)?.displayName }; })()`);
  await goto();
  await waitFor(() => evaluate('Boolean(document.querySelector(".menu-continue"))'));
  await pause(500);
  state = await menu();
  check(state.order[0] === 'nuova' && state.order[1] === 'continua', `Con una carriera: prima «Nuova partita», poi «Continua» (ordine: ${state.order.join(', ')}).`);
  check(!state.continueCard?.img?.includes('futuro-nazionale.png'), `Il riquadro «Continua» non usa il logo ufficiale di terzi (${state.continueCard?.img}).`);
  check(/Futuro Nazionale/.test(state.continueCard?.text ?? '') && state.continueCard.text.includes(before.player) && /Settimana \d+/.test(state.continueCard.text), `Con giocatore, partito, settimana e data (${state.continueCard?.text}).`);
  check(/^#[0-9a-f]{6}$/i.test(state.continueCard?.accent ?? ''), `Con il colore del partito (${state.continueCard?.accent}).`);
  // it is the same colour that the career then uses
  await click('[data-menu=continua]');
  await waitFor(() => evaluate('Boolean(document.querySelector(".page-wrap"))'));
  const inGame = await evaluate(`(() => { const shell = document.querySelector('.app-shell'); return { accent: getComputedStyle(shell).getPropertyValue('--party-accent').trim(), identity: shell.dataset.identity }; })()`);
  check(inGame.identity === 'partito' && inGame.accent === state.continueCard?.accent, `«Continua» riprende la carriera con lo stesso colore (${inGame.accent} / ${state.continueCard?.accent}).`);
  const after = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const s = store.getState(); return { week: s.game.week.index, date: s.clock.currentDate }; })()`);
  check(after.week === before.week && after.date === before.date, 'Aprire il menu e continuare non cambia la partita (settimana e data uguali).');
  // the menu opened again from inside the game: the same card, the career still there
  await click('[data-action=menu]');
  state = await menu();
  check(Boolean(state.continueCard) && !state.continueCard.img?.includes('futuro-nazionale.png'), 'Il menu aperto dalla partita mostra ancora la carriera, con il segno generato.');
  // the save slot and its row
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.saveToSlot(); return true; })()`);
  await click('[data-menu=carica]');
  const slots = await evaluate(`(() => ({ rows: document.querySelectorAll('.slot-row').length, marks: document.querySelectorAll('.slot-row .emblem').length, text: [...document.querySelectorAll('.slot-row')].map(el => el.textContent.replace(/\\s+/g, ' ').trim()).join(' | ').slice(0, 300), load: Boolean(document.querySelector('[data-slot-load]')) }))()`);
  check(slots.rows >= 2 && slots.load, `«Carica partita» elenca la partita in corso e lo slot salvato (${slots.text}).`);
  check(slots.marks >= 1, 'Ogni salvataggio mostra il segno del partito.');
  await click('[data-slot-load]');
  await waitFor(() => evaluate('Boolean(document.querySelector(".page-wrap"))'));
  const loaded = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const s = store.getState(); return { week: s.game.week.index, date: s.clock.currentDate }; })()`);
  check(loaded.week === before.week && loaded.date === before.date, 'Il salvataggio caricato è la stessa partita (nessun progresso perso).');

  // ---------- 2b. cancelling a new game goes back to the opening screen and leaves the career as it was ----------
  const snapshot = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const s = store.getState(); return JSON.stringify({ id: s.career.id, revision: store.revision(), week: s.game.week.index, date: s.clock.currentDate, slots: store.listSlots().map(item => [item.slot ?? item.id, item.savedAt ?? item.updatedAt ?? null]), meta: store.currentMeta() }); })()`);
  const setValue = (selector, value) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  let snap0 = null;
  const cancelledAt = async (step, how) => {
    state = await menu();
    check(!state.wizard && state.order[0] === 'nuova' && Boolean(state.continueCard), `${how}, passaggio ${step}: annullando si torna alla Home iniziale con «Continua» (ordine: ${state.order.join(', ')}).`);
    const now = await evaluate('Boolean(document.querySelector(".page-wrap .hq-panel, .page-wrap .hq-home")) && !document.querySelector(".main-menu")');
    check(!now, `${how}, passaggio ${step}: non si resta sulla schermata dell'ultima carriera.`);
    check(await snapshot() === snap0, `${how}, passaggio ${step}: la carriera precedente non cambia (revisione, data, settimana, slot e metadati uguali).`);
  };
  for (const [how, open] of [['dal menu', async () => { if (!await evaluate('Boolean(document.querySelector(".main-menu"))')) await click('[data-action=menu]'); await click('[data-menu=nuova]'); }], ['dalle impostazioni', async () => { if (await evaluate('Boolean(document.querySelector(".main-menu"))')) { await click('[data-menu=continua]'); await waitFor(() => evaluate('Boolean(document.querySelector(".page-wrap"))')); } await evaluate(`location.hash = '#impostazioni'; true`); await pause(600); await click('[data-action=new-career]'); }]]) {
    for (const step of [1, 2, 3]) {
      await open();
      await waitFor(() => evaluate('Boolean(document.querySelector(".career-wizard"))'));
      snap0 = await snapshot();
      if (step >= 2) {
        await setValue('.career-wizard [name="firstName"]', 'Anna'); await setValue('.career-wizard [name="lastName"]', 'Annullo'); await setValue('.career-wizard [name="birthDate"]', '1985-02-11'); await setValue('.career-wizard [name="previousProfession"]', 'Insegnante');
        await click('.wizard-footer [data-wizard-action="next"]');
        await waitFor(() => evaluate(`Boolean(document.querySelector('[data-wizard-region]'))`), 10000);
      }
      if (step >= 3) {
        await evaluate(`(() => { const r = document.querySelector('[data-wizard-region]'); r.value = 'Toscana'; r.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
        await waitFor(() => evaluate(`Boolean(document.querySelector('[data-wizard-municipality-search]'))`), 20000);
        await setValue('[data-wizard-municipality-search]', 'Siena');
        await waitFor(() => evaluate(`Boolean(document.querySelector('[data-municipality-code="052032"]'))`), 10000);
        await click('[data-municipality-code="052032"]'); await pause(400);
        await click('.wizard-footer [data-wizard-action="next"]'); await pause(500);
      }
      await click('[data-wizard-action=cancel]');
      await cancelledAt(step, how);
    }
  }
  // the previous career is loaded again only on request, and it is the same one
  await click('[data-menu=continua]');
  await waitFor(() => evaluate('Boolean(document.querySelector(".page-wrap"))'));
  { const was = JSON.parse(snap0), now = JSON.parse(await snapshot()); check(was.id === now.id && was.week === now.week && was.date === now.date, 'Riprendere con «Continua» dopo gli annullamenti carica la stessa carriera.'); }

  // ---------- 3. an independent: neutral, no invented symbol ----------
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.leaveParty(); return true; })()`);
  await click('[data-action=menu]');
  state = await menu();
  check(state.continueCard?.ghost && !state.continueCard.img && /Indipendente/.test(state.continueCard.text), `L’indipendente ha un segno neutro e la scritta Indipendente (${state.continueCard?.text}).`);

  // ---------- 4. widths, with a career ----------
  await widthsPass('con carriera');
  if (errors.length) problems.push(`Errori JavaScript: ${errors.slice(0, 3).join(' | ')}`);
});
if (problems.length) { console.error(`Schermata iniziale: ${problems.length} problemi.\n${[...new Set(problems)].slice(0, 60).join('\n')}`); process.exit(1); }
console.log('Schermata iniziale verificata in Chrome: «Nuova partita» per prima, «Continua» (solo con una carriera) con logo e colore del partito, poi carriere già fatte e aiuto; ogni voce apre il suo popup centrato sopra la homepage e lo richiude con la chiusura, «Annulla», Escape o lo sfondo (un clic dentro non lo chiude); Nuova partita apre i passaggi e annullare torna all’apertura; continuare e caricare uno slot riprendono la stessa partita; l’indipendente ha un segno neutro; a 320, 375, 390, 430, 768, 1024 e 1280 px nessuno scorrimento orizzontale, testi leggibili e le due azioni principali nella prima schermata del telefono.');
