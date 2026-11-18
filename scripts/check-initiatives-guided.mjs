// The page «Iniziative» reorganized, in Chrome with real clicks: the new collection first with a clear main button, the guided opening (two kinds, subjects with their own problem / objective / wording / articles,
// drafts that are really different and editable, costs shown, explicit confirmation), the groups (active, to complete, in verification, concluded), accordions, phone / tablet / desktop without horizontal scroll.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.error('SKIPPED: Chrome non trovato.'); process.exit(process.env.REQUIRE_CHROME ? 1 : 0); }
const OUT = new URL('../docs/qa/screenshots/final/', import.meta.url).pathname; await mkdir(OUT, { recursive: true });
// the library itself: real variety (no two subjects share the articles, the problem or the wording)
const { INITIATIVE_TOPICS, topicsFor } = await import('../src/data/initiative-drafts.js?v=lib');
const unique = key => new Set(INITIATIVE_TOPICS.map(item => (typeof key === 'function' ? key(item) : item[key]))).size;
assert.ok(INITIATIVE_TOPICS.length >= 24, `Almeno 24 argomenti (${INITIATIVE_TOPICS.length}).`);
for (const key of ['title', 'problem', 'objective', 'id']) assert.equal(unique(key), INITIATIVE_TOPICS.length, `Nessun argomento ripete ${key}.`);
assert.equal(unique(item => item.kind === 'referendum' ? item.question : item.wording), INITIATIVE_TOPICS.length, 'Nessuna formulazione ripetuta.');
const articleLines = INITIATIVE_TOPICS.flatMap(item => item.articles ?? []);
assert.equal(new Set(articleLines).size, articleLines.length, 'Nessun articolo è ripetuto tra gli argomenti.');
assert.ok(topicsFor('popolare').length >= 16 && topicsFor('referendum').length >= 8, 'Argomenti per entrambe le strade.');
assert.ok(new Set(topicsFor('popolare').map(item => item.area)).size >= 12, 'Almeno dodici temi diversi per le proposte popolari.');
for (const item of INITIATIVE_TOPICS) { assert.ok(item.title.length <= 90 && item.title.length >= 10, `${item.id}: titolo di lunghezza ammessa.`); if (item.kind === 'popolare') assert.ok(item.articles.length >= 3 && item.articles.length <= 8 && item.articles.every(line => /^Art\. \d+ — /.test(line)), `${item.id}: da tre a otto articoli numerati.`); else assert.ok(/^Volete voi che/.test(item.question), `${item.id}: il quesito è nella forma referendaria.`); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, screenshot, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'off' })); document.querySelectorAll('[data-report-close],[data-confirm=cancel]').forEach(b => b.click()); true`);
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const open = async () => { await evaluate(`location.hash = '#panoramica'; true`); await pause(400); await evaluate(`location.hash = '#iniziative'; true`); await pause(1500); };
  const set = (sel, value, ev = ['input', 'change']) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(value)}; for (const e of ${JSON.stringify(ev)}) el.dispatchEvent(new Event(e, { bubbles: true })); return true; })()`);
  await S(`const s = store.getState(); s.game.initiatives = []; s.game.resources.funds = 30000; s.game.resources.politicalCapital = 20; return true;`);
  await open();
  // the new collection comes first, with a clear main button
  assert.equal(await evaluate(`document.querySelector('[data-ini-page]').firstElementChild.hasAttribute('data-ini-new-card')`), true, 'NUOVA RACCOLTA è il primo blocco della pagina.');
  assert.ok(await evaluate(`(() => { const b = document.querySelector('[data-ini-new] > summary'); return b && b.classList.contains('primary-button') && b.getBoundingClientRect().height >= 44; })()`), 'Il pulsante principale è evidente e comodo da toccare.');
  assert.ok(await evaluate(`document.querySelector('[data-ini-new]').open`), 'Senza raccolte il modulo guidato è già aperto.');
  // the two kinds, the subjects for each
  assert.equal(await evaluate(`document.querySelectorAll('input[name=kind]').length`), 2);
  const popOptions = await evaluate(`document.querySelectorAll('[data-ini-topic] option').length`);
  assert.ok(popOptions >= 17, `Il menu degli argomenti per la proposta popolare ha le voci della libreria (${popOptions}).`);
  await set('[data-ini-topic]', 'p-sanita-attese'); await pause(700);
  assert.match(await evaluate(`document.querySelector('[data-ini-draft]')?.textContent ?? ''`), /Problema affrontato.*Obiettivo.*Formulazione.*Costo di apertura/s, 'La bozza mostra problema, obiettivo, formulazione e costi.');
  const t1 = { title: await evaluate(`document.querySelector('[name=title]').value`), articles: await evaluate(`document.querySelector('[name=articles]').value`), area: await evaluate(`document.querySelector('[name=area]').value`) };
  assert.equal(t1.title, 'Tempi massimi per le visite specialistiche'); assert.equal(t1.area, 'sanita'); assert.ok(t1.articles.split('\n').length >= 3 && /^Art\. 1/.test(t1.articles), 'Gli articoli sono pronti e coerenti con il tema.');
  await set('[data-ini-topic]', 'p-ambiente-suolo'); await pause(700);
  const t2 = { title: await evaluate(`document.querySelector('[name=title]').value`), articles: await evaluate(`document.querySelector('[name=articles]').value`) };
  assert.notEqual(t1.articles, t2.articles, 'Un altro argomento dà articoli diversi, non lo stesso testo con un altro titolo.');
  assert.match(t2.articles, /suolo/i, 'E coerenti con il nuovo tema.');
  // the referendum kind: other subjects, no articles, the question as a draft
  await evaluate(`(() => { const r = document.querySelector('input[name=kind][value=referendum]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await pause(800);
  assert.ok(await evaluate(`[...document.querySelectorAll('[data-ini-topic] option')].every(o => !o.value || o.value.startsWith('r-'))`), 'Per il referendum il menu offre solo gli argomenti referendari.');
  assert.equal(await evaluate(`document.querySelector('[data-ini-articles]').hidden`), true, 'Per il referendum gli articoli non servono.');
  await set('[data-ini-topic]', 'r-norma-orari'); await pause(600);
  assert.match(await evaluate(`document.querySelector('[data-ini-draft]').textContent`), /Quesito proposto.*Volete voi che/s);
  assert.match(await evaluate(`document.querySelector('[data-ini-draft]').textContent`), /4\.?000 €/, 'Il costo di apertura del referendum è mostrato.');
  // free text is allowed: the draft is editable; nothing starts without confirmation
  await evaluate(`(() => { const r = document.querySelector('input[name=kind][value=popolare]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await pause(700);
  await set('[data-ini-topic]', 'p-lavoro-salario'); await pause(600);
  await set('[name=title]', 'Salario minimo legale — versione dei cittadini');
  assert.equal(await S(`return store.initiatives().length;`), 0, 'Nessuna raccolta senza invio.');
  await evaluate(`document.querySelector('[data-ini-form]').requestSubmit(); true`); await pause(600);
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-confirm="ok"]'))`), 'L’apertura chiede conferma esplicita.');
  assert.equal(await S(`return store.initiatives().length;`), 0, 'Prima della conferma nulla è partito.');
  await evaluate(`document.querySelector('[data-confirm="cancel"]').click(); true`); await pause(900);
  assert.equal(await evaluate(`document.querySelector('[name=title]').value`), 'Salario minimo legale — versione dei cittadini', '«Torna alla bozza»: il testo scritto è ancora lì.');
  assert.equal(await S(`return store.initiatives().length;`), 0, '«Torna alla bozza» non apre nulla.');
  const fundsBefore = await S(`return store.getState().game.resources.funds;`);
  await evaluate(`document.querySelector('[data-ini-form]').requestSubmit(); true`); await pause(500); await evaluate(`document.querySelector('[data-confirm="ok"]').click(); true`); await pause(1200);
  const made = await S(`const i = store.initiatives()[0]; return { n: store.initiatives().length, title: i?.title, articles: i?.articles?.length, funds: store.getState().game.resources.funds };`);
  assert.equal(made.n, 1); assert.equal(made.title, 'Salario minimo legale — versione dei cittadini', 'Il titolo modificato dal giocatore è quello salvato.'); assert.ok(made.articles >= 3);
  assert.equal(made.funds, fundsBefore - 400, 'Il costo di apertura è pagato una sola volta.');
  // groups: active / to complete / in verification / concluded
  await S(`const g = store.getState().game; const base = g.initiatives[0]; const mk = (id, status, total) => ({ ...JSON.parse(JSON.stringify(base)), id, title: 'Raccolta ' + id, status, signatures: { ...base.signatures, total }, depositedAt: status === 'verifica' ? '2026-11-01' : null, verification: status === 'verifica' ? { until: '2027-01-01' } : undefined, outcome: status === 'fallita' ? 'Raccolta fallita: firme insufficienti.' : undefined }); g.initiatives = [base, mk('pronta', 'raccolta', 80000), mk('verifica-1', 'verifica', 52000), mk('chiusa-1', 'fallita', 9000)]; return true;`); await open();
  const groups = await evaluate(`[...document.querySelectorAll('.fold-panel .fold-title strong')].map(e => e.textContent.trim())`);
  for (const label of [/^Raccolte attive/, /^Da completare/, /^In verifica/, /^Concluse/]) assert.ok(groups.some(g => label.test(g)), `Gruppo ${label} presente.`);
  assert.match(await evaluate(`document.querySelector('.sx-kpis').textContent`), /Firme raccolte/); assert.match(await evaluate(`document.querySelector('.sx-kpis').textContent`), /Fondi/);
  assert.ok(await evaluate(`document.querySelectorAll('[data-initiative] details summary').length >= 3`), 'Dettagli, firme per Regione, testo e storia stanno in accordion.');
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-ini-new] > summary.primary-button'))`), 'Con raccolte esistenti il pulsante principale resta in cima (lo stato aperto/chiuso è quello scelto dal giocatore).');
  // layouts
  for (const width of [390, 820, 1280]) {
    await viewport(width, width < 500 ? 844 : 1000); await open();
    await evaluate(`[...document.querySelectorAll('button')].filter(b => /^Chiudi$/.test(b.textContent.trim())).forEach(b => b.click()); document.querySelector('[data-ini-new]').open = true; true`); await pause(400);
    const m = await evaluate(`({ doc: document.documentElement.scrollWidth, vw: innerWidth, over: [...document.querySelectorAll('[data-ini-page] *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1; }).map(e => e.tagName + '.' + e.className + ':' + Math.round(e.getBoundingClientRect().right)).slice(0, 5) })`);
    assert.ok(m.doc <= m.vw + 1 && !m.over.length, `${width}px: nessuno scorrimento orizzontale (${m.doc}/${m.vw}) ${m.over.join(' | ')}.`);
    await screenshot(`${OUT}iniziative-${width}.png`);
  }
  assert.deepEqual(errors.filter(e => !/api\//.test(String(e))), [], 'Nessun errore in pagina.');
});
console.log('Pagina Iniziative riorganizzata verificata in Chrome: nuova raccolta in primo piano, apertura guidata con libreria di argomenti diversi, conferma esplicita, gruppi e accordion, tre larghezze; schermate in docs/qa/screenshots/final.');
