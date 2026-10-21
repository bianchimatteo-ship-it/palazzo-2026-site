// Hall of Fame: the archive of concluded careers, in a real browser. The list (best first, the data of each career as it is stored), the empty state, long names and several kinds of party
// (real with logo, old entry without an id, independent), the figures shown are the stored ones (score, tier, peak office, years, mandates, laws, objectives), the actions «Nuova carriera con
// questa eredità» (data-hall-legacy opens the new-game steps with that legacy) and «Elimina dalla Hall of Fame» (data-hall-delete, with a confirmation, then gone from the storage), on 320,
// 360, 390, 430, 768, 1024 and 1440 px with no overflow and cards stacked on a phone.
import assert from 'node:assert/strict';
import { chromeAvailable, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Hall of Fame nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).'); process.exit(0); }
const entry = (id, over = {}) => ({ id, careerId: `c-${id}`, name: 'Politico di prova', kind: 'pensionamento', endLabel: 'È andato in pensione', startedAt: '2000-01-01', endedAt: '2026-01-01', age: 66, years: 26, weeks: 1352, level: 'deputato', difficulty: 'normale', startProfile: 'ordinaria', peak: { label: 'Ministro', value: 75 }, party: null, pastParties: 0, counts: { mandates: 5, laws: 4, objectives: 15, scandals: 2, setbacks: 0, ambitionsBroken: 0 }, score: 68, tier: { id: 'protagonista', label: 'Protagonista di una stagione' }, parts: [{ label: 'Anni di carriera', points: 14 }, { label: 'Carica più alta', points: 26 }], tags: ['Ex ministro'], source: 'simulation', ...over });
const HALL = [
  entry('hall-a', { name: 'Maria Concetta Vittoria Alessandra Rossi-Bianchi di San Giovanni in Persiceto', score: 91, tier: { id: 'statista', label: 'Statista' }, peak: { label: 'Presidente del Consiglio dei ministri e Presidente della Repubblica (cariche multiple)', value: 100 }, party: { id: 'party-registro-p1-2014-01-ir', label: 'Partito di prova con un nome ufficiale molto, molto lungo', rankTitle: 'Segretario nazionale', founded: false }, tags: ['Ex premier', 'Fondatore', 'Mandati multipli', 'Costruttore di coalizioni'] }),
  entry('hall-b', { name: 'Giulio Verdi', score: 55, tier: { id: 'rilievo', label: 'Figura di rilievo' }, peak: { label: 'Sindaco', value: 40 }, party: { label: 'Partito scomparso senza identificativo', rank: 2, rankTitle: 'Iscritto' }, level: 'comunale', counts: { mandates: 2, laws: 0, objectives: 3 } }),
  entry('hall-c', { name: 'Anna Indipendente', score: 22, tier: { id: 'mestiere', label: 'Politico di mestiere' }, peak: null, party: null, years: 3.5, counts: { mandates: 0, laws: 0, objectives: 1 }, tags: [] })
];
const WIDTHS = [[320, 700], [360, 740], [390, 800], [430, 900], [768, 1000], [1024, 800], [1440, 900]];
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors }) => {
  const openHall = async () => { await goto(); await wait(() => evaluate('Boolean(document.querySelector(".main-menu"))')); await evaluate(`document.querySelector('[data-menu="hall"]').click(); true`); await wait(() => evaluate('Boolean(document.querySelector(".menu-popup-body .hall-head"))')); await pause(300); };
  // empty state
  await evaluate(`localStorage.removeItem('politicando.hall.v1'); localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true })); true`);
  await openHall();
  assert.equal(await evaluate(`document.querySelector('[data-hall-count]').dataset.hallCount`), '0', 'Zero carriere concluse.');
  assert.ok(/Nessuna carriera conclusa/.test(await evaluate(`document.querySelector('.hall-empty').innerText`)), 'Lo stato vuoto lo dice.');
  assert.equal(await evaluate(`document.querySelectorAll('.hall-card').length`), 0);
  // the list
  await evaluate(`localStorage.setItem('politicando.hall.v1', ${JSON.stringify(JSON.stringify(HALL))}); true`);
  for (const [width, height] of WIDTHS) {
    await viewport(width, height, width < 800);
    await openHall();
    const hall = await evaluate(`(() => { const cards = [...document.querySelectorAll('.hall-card')]; const root = document.querySelector('.menu-popup-body'); const d = document.documentElement; const box = el => el.getBoundingClientRect();
      return { count: document.querySelector('[data-hall-count]').dataset.hallCount, heading: document.querySelector('.hall-head h2').textContent, order: cards.map(c => c.dataset.hallEntry), scores: cards.map(c => c.querySelector('.hall-score b').textContent),
        peaks: cards.map(c => c.querySelector('.hall-peak strong').textContent), names: cards.map(c => c.querySelector('h3').textContent), seals: cards.map(c => c.querySelectorAll('.hall-seal .emblem').length), legacy: cards.map(c => c.querySelectorAll('[data-hall-legacy]').length), del: cards.map(c => c.querySelectorAll('[data-hall-delete]').length),
        stacked: cards.every((c, i) => i === 0 || box(c).top >= box(cards[i - 1]).bottom - 1), overCards: cards.some(c => c.scrollWidth > c.clientWidth + 1), over: d.scrollWidth > innerWidth + 1, rootOver: root.scrollWidth > root.clientWidth + 1,
        buttons: cards.flatMap(c => [...c.querySelectorAll('.hall-actions button')].map(b => [Math.round(box(b).height), Math.round(box(b).width), box(b).right <= innerWidth + 0.5 && box(b).left >= -0.5])), single: cards.length > 0 && cards.every(c => box(c).width > 0),
        text: cards.map(c => c.innerText) }; })()`);
    assert.equal(hall.count, '3', `${width}px: tre carriere.`);
    assert.equal(hall.heading, 'Hall of Fame');
    assert.deepEqual(hall.order, ['hall-a', 'hall-b', 'hall-c'], `${width}px: la migliore per prima.`);
    assert.deepEqual(hall.scores, ['91', '55', '22'], `${width}px: i punteggi sono quelli salvati.`);
    assert.deepEqual(hall.seals, [1, 1, 1], `${width}px: ogni scheda ha il simbolo del partito (logo, sigla o neutro).`);
    assert.deepEqual(hall.legacy, [1, 1, 1]); assert.deepEqual(hall.del, [1, 1, 1], `${width}px: le due azioni per carriera.`);
    assert.ok(hall.peaks[0].includes('Presidente del Consiglio') && hall.peaks[2] === 'Nessuna', `${width}px: carica più alta come salvata (${hall.peaks}).`);
    assert.ok(hall.text[0].includes('26') && hall.text[0].includes('5') && /mandati conquistati/i.test(hall.text[0]) && /leggi approvate/i.test(hall.text[0]) && /obiettivi raggiunti/i.test(hall.text[0]), `${width}px: anni, mandati, leggi e obiettivi.`);
    assert.ok(hall.text[1].includes('Partito scomparso senza identificativo'), `${width}px: un’annotazione senza id mostra comunque il nome del partito.`);
    assert.ok(/Indipendente/.test(hall.text[2]), `${width}px: l’indipendente è dichiarato tale.`);
    assert.ok(hall.stacked && !hall.over && !hall.rootOver && !hall.overCards, `${width}px: schede una sotto l’altra, nulla fuori dallo schermo.`);
    assert.ok(hall.buttons.every(([h, w, inside]) => h >= 40 && inside), `${width}px: pulsanti da tocco dentro lo schermo (${JSON.stringify(hall.buttons.slice(0, 2))}).`);
    if (width <= 430) assert.ok(await evaluate(`[...document.querySelectorAll('.hall-card')].every(c => c.getBoundingClientRect().width > innerWidth * 0.78)`), `${width}px: su smartphone le schede usano la larghezza.`);
  }
  // delete: confirmation, then gone
  await viewport(390, 800, true); await openHall();
  await evaluate(`document.querySelector('[data-hall-delete="hall-c"]').click(); true`); await pause(500);
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-confirm="ok"]'))`), 'Eliminare chiede conferma.');
  assert.equal(JSON.parse(await evaluate(`localStorage.getItem('politicando.hall.v1')`)).length, 3, 'Prima della conferma non è stato eliminato nulla.');
  await evaluate(`document.querySelector('[data-confirm="cancel"]').click(); true`); await pause(400);
  assert.equal(JSON.parse(await evaluate(`localStorage.getItem('politicando.hall.v1')`)).length, 3, 'Annullare non elimina.');
  await evaluate(`document.querySelector('[data-hall-delete="hall-c"]').click(); true`); await pause(500);
  await evaluate(`document.querySelector('[data-confirm="ok"]').click(); true`); await pause(700);
  assert.deepEqual(JSON.parse(await evaluate(`localStorage.getItem('politicando.hall.v1')`)).map(item => item.id), ['hall-a', 'hall-b'], 'Dopo la conferma la carriera non è più nella Hall.');
  await evaluate(`document.querySelector('[data-menu="hall"]')?.click?.(); true`); await pause(300);
  // a new career with this legacy: the new-game steps open on that legacy
  if (!await evaluate(`Boolean(document.querySelector('[data-hall-legacy]'))`)) await openHall();
  await evaluate(`document.querySelector('[data-hall-legacy="hall-b"]').click(); true`);
  await wait(() => evaluate(`Boolean(document.querySelector('.start-banner, [data-wizard-legacy], .career-wizard'))`), 20000);
  await pause(1500);
  const banner = await evaluate(`(document.querySelector('.start-banner')?.innerText ?? '') + '|' + (document.querySelector('[data-wizard-legacy]')?.value ?? '')`);
  assert.ok(/Giulio Verdi/.test(banner) || /hall-b/.test(banner), `La nuova carriera parte dall’eredità scelta (${banner}).`);
  assert.deepEqual(JSON.parse(await evaluate(`localStorage.getItem('politicando.hall.v1')`)).map(item => item.id), ['hall-a', 'hall-b'], 'Aprire una nuova carriera con un’eredità non tocca la Hall.');
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
});
console.log('Hall of Fame verificata (320, 360, 390, 430, 768, 1024 e 1440 px): stato vuoto, tre carriere con nomi e cariche molto lunghi, partito con logo o sigla, senza identificativo e indipendente, punteggi e dati salvati, schede impilate senza overflow, eliminazione con conferma (annullare non elimina), nuova carriera con eredità che apre i passaggi con quell’eredità e lascia intatta la Hall.');
