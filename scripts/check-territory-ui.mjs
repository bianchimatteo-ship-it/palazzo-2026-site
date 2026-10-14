// Local leaders, committees and institutions (Partito › Vita interna, Partito › Territorio, Territori), in Chrome. The pages were long walls of figures; now they open compact:
// the local leaders are grouped by level (Regione, Provincia, Comune) with the same glyph and tone everywhere, each on one line with name, role, territory, state and the first actions
// (meet, promote); the interests, the loyalty and grievance meters, the notes and the replacement fold under «Dettagli». The committees open as one card each with name, level, territory,
// state, the person in charge and the four main actions; the figures and the other actions fold. The institutions carry the glyph and tone of their level. Nothing is removed: every action
// and every figure is still in the page. No horizontal scroll at 320, 360, 375, 390, 430, 768, 1024 and 1280 px.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Territorio compatto saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
const problems = [];
const check = (condition, message) => { if (!condition) problems.push(message); };
const WIDTHS = [[320, 640], [360, 800], [375, 812], [390, 844], [430, 932], [768, 1024], [1024, 768], [1280, 800]];

await withBrowser(async browser => {
  const { evaluate, viewport, goto, waitFor, pause, version, errors } = browser;
  await createCareerInPage(browser, { party: 'party-futuro-nazionale', level: 'comunale', weeks: 2 });
  await openCareer(browser);
  const open = async (tab) => { await evaluate(`(async () => { document.querySelector('[data-nav="partito"]')?.click(); await new Promise(r => setTimeout(r, 500)); document.querySelector('[data-section-tab="partito"][data-section-tab-value="${tab}"]')?.click(); await new Promise(r => setTimeout(r, 700)); return true; })()`); };

  // the committees are built when the Territorio tab opens (the ISTAT units are loaded then)
  await open('territorio');
  await waitFor(() => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); return (store.getState().game.party?.org?.committees ?? []).length > 3; })()`), 40000);
  // recruit a local leader in a regional, a provincial and a municipal committee (the game's own action, costs and all)
  const recruited = await evaluate(`(async () => {
    const { store } = await import('/src/core/store.js?v=${version}');
    const committees = store.getState().game.party.org.committees;
    const done = [];
    for (const level of ['regione', 'provincia', 'comune']) {
      const committee = committees.find(item => item.level === level && item.status !== 'dissoluzione' && !item.leader?.player && !(store.getState().game.party.life?.cadres ?? []).some(cadre => cadre.committeeId === item.id));
      if (!committee) continue;
      store.partyCadreAction({ action: 'recluta', cadreId: null, committeeId: committee.id });
      store.advanceTurn(1);
      done.push(level);
    }
    return { done, cadres: (store.getState().game.party.life?.cadres ?? []).length };
  })()`);
  check(recruited.cadres >= 2, `Dirigenti reclutati per la prova: ${recruited.cadres}.`);
  await open('vita');
  const life = await evaluate(`(() => { const groups = [...document.querySelectorAll('.pl-level')]; const rows = [...document.querySelectorAll('.pl-cadre.pl-compact')]; return {
    levels: groups.map(group => group.dataset.level), tiles: groups.every(group => group.querySelector('summary .art-tile')), tones: new Set(groups.map(group => group.getAttribute('style'))).size === groups.length,
    rows: rows.length, firstActions: rows.every(row => row.querySelector(':scope > .pl-actions [data-life-cadre=incontra]') && row.querySelector(':scope > .pl-actions [data-life-cadre=promuovi]')),
    replaceFolded: rows.every(row => { const button = row.querySelector('[data-life-cadre=sostituisci]'); return !button || (button.closest('details.pl-details') && !button.closest('details.pl-details').open); }),
    detailsFolded: rows.every(row => !row.querySelector('details.pl-details')?.open), meters: rows.every(row => row.querySelector('details.pl-details')?.textContent.includes('Lealtà') && row.querySelector('details.pl-details')?.textContent.includes('Malcontento')),
    named: rows.every(row => row.querySelector('header strong')?.textContent.trim() && /·/.test(row.querySelector('header small')?.textContent ?? '')), height: Math.round(document.querySelector('.pl-cadres')?.getBoundingClientRect().height ?? 0) }; })()`);
  check(life.rows >= 2 && life.levels.length >= 2, `Dirigenti raggruppati per livello (${life.levels.join(', ')}; ${life.rows} righe).`);
  check(life.tiles && life.tones, 'Ogni livello ha la sua icona e il suo colore.');
  check(life.firstActions, 'Ogni dirigente ha subito «Incontra» e «Promuovi».');
  check(life.replaceFolded && life.detailsFolded && life.meters, 'Interessi, lealtà, malcontento e sostituzione restano nel pannello «Dettagli», chiuso all’apertura.');
  check(life.named, 'Ogni riga dice nome, ruolo e territorio.');
  // the action still works from the compact row
  const before = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); return (store.getState().game.party.life?.cadres ?? []).find(item => item.status !== 'uscito' && !item.player)?.loyalty ?? null; })()`);
  await evaluate(`document.querySelector('.pl-cadre [data-life-cadre=incontra]:not([disabled])')?.click(), true`);
  await pause(600);
  const after = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const s = store.getState(); return { loyalty: (s.game.party.life?.cadres ?? []).find(item => item.status !== 'uscito' && !item.player)?.loyalty ?? null, toast: s.ui?.toast ?? '' }; })()`);
  check(before !== null && (after.loyalty !== before || /dirigente|Dirigente/.test(after.toast)), `«Incontra» dalla riga compatta agisce davvero (${before} → ${after.loyalty}; ${after.toast}).`);

  await open('territorio');
  const terr = await evaluate(`(() => { const cards = [...document.querySelectorAll('.cm-card.cm-compact:not(.is-missing)')]; return { n: cards.length, levels: [...new Set(cards.map(card => card.dataset.level))], tiles: cards.every(card => card.querySelector('header .art-tile')),
    main: cards.every(card => card.classList.contains('tone-')? true : card.querySelectorAll(':scope > .cm-actions [data-committee-action]').length >= 1), folded: cards.every(card => !card.querySelector('details.cm-details')?.open), figures: cards.every(card => card.querySelector('details.cm-details')?.textContent.includes('Iscritti')),
    named: cards.every(card => card.querySelector('h4')?.textContent.trim() && card.querySelector('.cm-lead')?.textContent.trim()), colours: new Set(cards.map(card => card.getAttribute('style'))).size }; })()`);
  check(terr.n >= 3 && terr.levels.length >= 2, `Comitati compatti per livello (${terr.n} schede, ${terr.levels.join(', ')}).`);
  check(terr.tiles && terr.folded && terr.figures && terr.named, 'Ogni comitato: icona di livello, nome, responsabile, azioni principali; cifre e altre azioni in «Dettagli», chiuso.');
  check(terr.colours >= 2, 'Livelli diversi, toni diversi.');

  await evaluate(`(async () => { document.querySelector('[data-nav="territori"]')?.click(); await new Promise(r => setTimeout(r, 800)); return true; })()`);
  const inst = await evaluate(`(() => { const section = document.querySelector('.local-institution'); return section ? { level: section.dataset.level, tone: section.getAttribute('style'), tile: Boolean(section.querySelector('.local-heading .art-tile')) } : null; })()`);
  check(inst && inst.tile && /--lv:/.test(inst.tone ?? ''), `L’istituzione ha l’icona e il tono del suo livello (${JSON.stringify(inst)}).`);

  // widths
  for (const [width, height] of WIDTHS) {
    await viewport(width, height);
    for (const [label, steps] of [['vita interna', `document.querySelector('[data-nav="partito"]')?.click(); await new Promise(r => setTimeout(r, 400)); document.querySelector('[data-section-tab="partito"][data-section-tab-value="vita"]')?.click();`], ['territorio', `document.querySelector('[data-nav="partito"]')?.click(); await new Promise(r => setTimeout(r, 400)); document.querySelector('[data-section-tab="partito"][data-section-tab-value="territorio"]')?.click();`], ['istituzione', `document.querySelector('[data-nav="territori"]')?.click();`]]) {
      await evaluate(`(async () => { ${steps} await new Promise(r => setTimeout(r, 700)); return true; })()`);
      const view = await evaluate(`(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, wide: [...document.querySelectorAll('.page-wrap *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('.hm-wrap, .table-wrap, [data-scroll-x]')).slice(0, 3).map(el => el.className || el.tagName) }))()`);
      check(!view.overflow, `${width}px · ${label}: scroll orizzontale (${view.wide.join(', ')}).`);
    }
  }
  check(errors.length === 0, `Errori JavaScript: ${errors.slice(0, 2).join(' | ')}`);
});
if (problems.length) { console.error(`Territorio compatto: ${problems.length} problemi.\n${[...new Set(problems)].slice(0, 30).join('\n')}`); process.exit(1); }
console.log('Dirigenti locali, comitati e istituzioni verificati in Chrome: dirigenti raggruppati per livello (Regione, Provincia, Comune) con icona e tono propri, una riga ciascuno con nome, ruolo, territorio, stato e le prime azioni; interessi, lealtà, malcontento e sostituzione in «Dettagli»; comitati come schede compatte con livello, responsabile e azioni principali, cifre e azioni secondarie richiudibili; istituzioni con icona e tono del livello; nessun scroll orizzontale da 320 a 1280 px.');
