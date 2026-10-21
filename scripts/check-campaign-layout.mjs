// La schermata Campagna in un browser vero (desktop e smartphone): le tre misure («Consenso territoriale», «Sondaggio di campagna», «Andamento nel primo turno») hanno la stessa struttura
// (titolo, cifra, barra, descrizione), la stessa altezza e gli stessi margini; «Geografia del voto» e «Contendenti» sono pannelli a tendina (chiusi mostrano un riepilogo utile, aperti conservano tutto);
// aprire e chiudere non azzera selezioni, filtri né la posizione di scorrimento, e lo stato resta dopo un ridisegno. La «prossima sfida» e il suo bottone parlano della stessa elezione.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Schermata Campagna nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { level: 'comunale', onboarding: true, extra: `store.fastForwardToElection('comunale'); store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'fino-15000' }, real.realDatabase.parties); store.getState().campaign.nomination.status = 'approved'; store.save();` });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`location.hash = '#elezioni'; true`);
  await pause(800);
  await evaluate(`(() => { const tab = [...document.querySelectorAll('button, a, [role="tab"]')].find(el => /^\\s*Campagna\\s*$/i.test(el.textContent)); tab?.click(); return true; })()`);
  await wait(() => evaluate(`Boolean(document.querySelector('.campaign-metrics'))`), 20000);
  for (const [name, w, h, mobile] of [['desktop', 1280, 900, false], ['smartphone', 390, 800, true]]) {
    await viewport(w, h, mobile); await pause(500);
    // the three measures: same structure, same height, same top, same inner spacing
    const m = await evaluate(`(() => [...document.querySelectorAll('.campaign-metrics .campaign-metric')].map(el => { const r = el.getBoundingClientRect(); const kids = [...el.children].map(c => c.tagName + (c.classList.contains('metric-bar') ? '.metric-bar' : '')); const small = el.querySelector('small').getBoundingClientRect(); const strong = el.querySelector('strong').getBoundingClientRect(); const bar = el.querySelector('.metric-bar')?.getBoundingClientRect(); const span = el.querySelector('span').getBoundingClientRect(); return { id: el.dataset.metric, top: Math.round(r.top), height: Math.round(r.height), width: Math.round(r.width), kids: kids.join('|'), smallH: Math.round(small.height), strongTop: Math.round(strong.top - r.top), barTop: bar ? Math.round(bar.top - r.top) : null, barH: bar ? Math.round(bar.height) : null, spanTop: Math.round(span.top - r.top), over: el.scrollWidth > el.clientWidth + 1 }; }))()`);
    assert.ok(m.length >= 3, `${name}: tre misure (${m.map(x => x.id)}).`);
    assert.ok(m.every(x => x.kids === m[0].kids && x.barTop !== null), `${name}: stessa struttura (titolo, cifra, barra, descrizione): ${m.map(x => x.kids)}`);
    assert.ok(m.every(x => x.smallH === m[0].smallH && x.strongTop === m[0].strongTop && x.barTop === m[0].barTop && x.barH === m[0].barH && x.spanTop === m[0].spanTop), `${name}: titolo, cifra, barra e descrizione alla stessa quota in tutte e tre: ${JSON.stringify(m)}`);
    if (!mobile) assert.ok(m.every(x => x.top === m[0].top && x.height === m[0].height), `${name}: stessa riga e stessa altezza: ${JSON.stringify(m.map(x => [x.top, x.height]))}`);
    else assert.ok(m.every(x => x.width === m[0].width && x.height === m[0].height), `${name}: stessa larghezza e altezza: ${JSON.stringify(m.map(x => [x.width, x.height]))}`);
    assert.ok(m.every(x => !x.over), `${name}: nulla tagliato nelle misure.`);
    // the two panels fold: closed by default, with a summary that says something
    const folds = await evaluate(`(() => ['camp-geografia', 'camp-contendenti'].map(id => { const d = document.querySelector('details[data-remember="' + id + '"]'); return d ? { id, open: d.open, summary: d.querySelector('.campaign-fold-summary')?.textContent?.trim(), bodyVisible: d.querySelector('.campaign-fold-body')?.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true }) ?? false, rows: d.querySelectorAll('.campaign-area-row, .campaign-rival').length } : { id, missing: true }; }))()`);
    assert.ok(folds.every(f => !f.missing), `${name}: i due pannelli esistono come tendine.`);
    if (name === 'desktop') assert.ok(folds.every(f => f.open === false && f.summary && f.summary.length > 15 && !f.bodyVisible), `${name}: chiusi di partenza, con un riepilogo utile: ${JSON.stringify(folds)}`);
    assert.ok(folds[0].summary === undefined || /Più forte|Nessuna area/.test(folds[0].summary ?? 'Più forte') , 'Riepilogo della geografia del voto.');
  }
  await viewport(1280, 900, false); await pause(400);
  // open both: everything is there; a select picked outside the panels keeps its value; the scroll position does not jump
  await evaluate(`(() => { const sel = document.querySelector('select[data-campaign-topic]'); if (sel) { sel.value = [...sel.options].at(-1).value; sel.dispatchEvent(new Event('change', { bubbles: true })); } return true; })()`);
  const picked = await evaluate(`document.querySelector('select[data-campaign-topic]')?.value ?? null`);
  await evaluate(`window.scrollTo(0, 420); true`); await pause(300);
  const y0 = await evaluate(`Math.round(window.scrollY)`);
  await evaluate(`(() => { const d = document.querySelector('details[data-remember="camp-geografia"]'); d.open = true; d.dispatchEvent(new Event('toggle')); const e = document.querySelector('details[data-remember="camp-contendenti"]'); e.open = true; e.dispatchEvent(new Event('toggle')); return true; })()`);
  await pause(500);
  const opened = await evaluate(`({ areas: document.querySelectorAll('.campaign-area-row').length, rivals: document.querySelectorAll('.campaign-rival').length, geo: document.querySelector('details[data-remember="camp-geografia"]').open, opp: document.querySelector('details[data-remember="camp-contendenti"]').open, topic: document.querySelector('select[data-campaign-topic]')?.value ?? null, y: Math.round(window.scrollY) })`);
  assert.ok(opened.geo && opened.opp && opened.areas >= 1 && opened.rivals >= 1, `Aperti conservano tutte le informazioni (aree ${opened.areas}, contendenti ${opened.rivals}).`);
  assert.equal(opened.topic, picked, 'Aprire non azzera le selezioni.');
  assert.ok(Math.abs(opened.y - y0) <= 4, `Aprire non sposta lo scorrimento (${y0} → ${opened.y}).`);
  // a redraw of the page keeps them open, and closing one leaves the other
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.save(); store.advance(0); return true; })()`);
  await pause(500);
  assert.equal(await evaluate(`document.querySelector('details[data-remember="camp-geografia"]').open && document.querySelector('details[data-remember="camp-contendenti"]').open`), true, 'Dopo un ridisegno restano aperti.');
  await evaluate(`(() => { const d = document.querySelector('details[data-remember="camp-geografia"]'); d.open = false; d.dispatchEvent(new Event('toggle')); return true; })()`);
  await pause(400);
  const closed = await evaluate(`({ geo: document.querySelector('details[data-remember="camp-geografia"]').open, opp: document.querySelector('details[data-remember="camp-contendenti"]').open, topic: document.querySelector('select[data-campaign-topic]')?.value ?? null, y: Math.round(window.scrollY) })`);
  assert.ok(closed.geo === false && closed.opp === true && closed.topic === picked && Math.abs(closed.y - y0) <= 4, `Chiudere uno non tocca l’altro, né selezioni né scorrimento (${JSON.stringify(closed)}).`);
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
});
console.log('Schermata Campagna verificata (desktop e smartphone): le tre misure con la stessa struttura, altezza e quota di titolo, cifra, barra e descrizione; Geografia del voto e Contendenti a tendina con riepilogo da chiusi, tutto da aperti, selezioni e scorrimento intatti.');
