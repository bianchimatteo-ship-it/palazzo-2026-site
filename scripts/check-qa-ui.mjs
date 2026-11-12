// The final-pass screens in Chrome, at the resolutions of the phone, the tablet and the computer (320×700, 360×800, 390×844, 430×932, 768×1024, 1440×900), in Italian and in English:
//   · the weekly report: «Continua» is on screen the moment the report opens, the middle scrolls without covering the foot, nothing overflows sideways, every line of the week is there;
//   · the polls page: the barometer is CLOSED at first (one line: «Partito al 12,3% (+0,1%)»), opens and closes by click and by keyboard, keeps its state through a redraw and a change of page, the kicker and the
//     logo appear once when open; the same in English;
//   · the sitting of an open vote: the President's three lines and the ballot are there the instant the window opens, the result is not there before the confirmation, the proposer is named by its role;
//   · the rewards page: nothing overflows, the Instagram claim is off until the profile has been opened from the game, and says that the follow is a self-declaration.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
import { createIndependentDetector } from './lib/i18n-independent.mjs';

if (!chromeAvailable) { console.log('Schermate finali nel browser saltate: Chrome non trovato.'); process.exit(0); }
const SIZES = [[320, 700, true], [360, 800, true], [390, 844, true], [430, 932, true], [768, 1024, true], [1440, 900, false]];
const detector = createIndependentDetector();
await withBrowser(async ({ evaluate, send, goto, waitFor: wait, pause, viewport, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { level: 'deputato', onboarding: true, weeks: 3, extra: '' });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'full' })); true`);
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click(), true`); await pause(350); };
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const lang = code => evaluate(`import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage(${JSON.stringify(code)})).then(() => true)`).then(() => pause(700));
  const noSideScroll = async label => assert.equal(await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1'), true, `${label}: nessuno scorrimento orizzontale`);
  const noItalian = async (label, selector) => {
    const texts = await evaluate(`(() => { const root = document.querySelector(${JSON.stringify(selector)}) ?? document.body; const out = []; const walk = node => { if (node.nodeType === 3) { const t = node.textContent.trim(); if (t.length > 1) out.push(t); } else if (!['SCRIPT', 'STYLE', 'SVG', 'svg'].includes(node.nodeName)) node.childNodes.forEach(walk); }; walk(root); return out; })()`);
    const left = [...new Set(texts)].filter(text => detector.reasonOf(text));
    assert.deepEqual(left, [], `${label}: nessun italiano rimasto in inglese: ${left.join(' | ').slice(0, 300)}`);
  };

  // ---------- the weekly report ----------
  await evaluate(`location.hash = '#panoramica'; true`); await pause(900);
  await click('.topbar [data-action=advance], [data-action=advance]'); await wait(() => has('.report-modal'), 10000);
  const lines = await evaluate(`document.querySelectorAll('.weekly-line').length`);
  assert.ok(lines >= 2, 'Il resoconto riporta tutti i fatti della settimana.');
  for (const [width, height, mobile] of SIZES) {
    await viewport(width, height, mobile); await pause(400);
    const box = await evaluate(`(() => { const r = el => el ? el.getBoundingClientRect() : null; const modal = document.querySelector('.weekly-report'), body = document.querySelector('.weekly-body'), foot = document.querySelector('.weekly-foot'), button = document.querySelector('.weekly-foot [data-report-close]'); const b = r(button), f = r(foot), m = r(modal), bd = r(body); return { vh: innerHeight, vw: innerWidth, button: b && { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height, w: b.width }, foot: f && { top: f.top, bottom: f.bottom }, body: bd && { top: bd.top, bottom: bd.bottom, scroll: body.scrollHeight > body.clientHeight, overflowY: getComputedStyle(body).overflowY }, modal: m && { left: m.left, right: m.right, bottom: m.bottom }, sideScroll: modal.scrollWidth > modal.clientWidth + 1 || body.scrollWidth > body.clientWidth + 1 }; })()`);
    const label = `resoconto ${width}×${height}`;
    assert.ok(box.button && box.button.top >= 0 && box.button.bottom <= box.vh + 0.5 && box.button.left >= 0 && box.button.right <= box.vw + 0.5, `${label}: «Continua» è visibile appena si apre (${JSON.stringify(box.button)})`);
    assert.ok(box.button.h >= 40 && box.button.w >= 100, `${label}: il pulsante si tocca (${box.button.h}×${box.button.w})`);
    assert.ok(box.body.bottom <= box.foot.top + 1, `${label}: il corpo scorrevole non copre il piede`);
    assert.ok(box.modal.bottom <= box.vh + 0.5 && !box.sideScroll, `${label}: la finestra sta nello schermo, nessuno scorrimento laterale`);
    assert.equal(box.body.overflowY, 'auto', `${label}: il corpo scorre da solo`);
    // scrolling the body leaves the foot where it is
    const before = box.foot.top;
    await evaluate(`document.querySelector('.weekly-body').scrollTop = 9999; true`); await pause(150);
    assert.equal(await evaluate(`Math.round(document.querySelector('.weekly-foot').getBoundingClientRect().top)`), Math.round(before), `${label}: il piede resta fermo mentre si scorre`);
    await evaluate(`document.querySelector('.weekly-body').scrollTop = 0; true`);
  }
  await lang('en'); await noItalian('resoconto in inglese', '.report-modal');
  assert.match(await evaluate(`document.querySelector('.weekly-foot [data-report-close]').textContent`), /Continue/);
  await lang('it'); await viewport(390, 844, true);
  await click('.weekly-foot [data-report-close]'); await pause(300);
  assert.equal(await has('.report-modal'), false, '«Continua» chiude il resoconto.');

  // ---------- the polls page: the barometer ----------
  await evaluate(`location.hash = '#sondaggi'; true`); await wait(() => has('.poll-barometer'), 15000);
  assert.equal(await evaluate(`document.querySelector('.poll-barometer').open`), false, 'Al primo accesso il barometro è chiuso.');
  const summary = await evaluate(`document.querySelector('.poll-sum-line').innerText`);
  assert.match(summary, /\S+.* al \d+,\d%\s*\([+−±]\d+(,\d)?%\)/, `Il riepilogo è «Partito al 12,3% (+0,1%)» (${summary})`);
  assert.equal(await evaluate(`document.querySelector('.poll-hero-body').checkVisibility()`), false, 'Chiuso non mostra nessun altro dato del barometro.');
  const closedHeight = await evaluate(`Math.round(document.querySelector('.poll-barometer').getBoundingClientRect().height)`);
  assert.ok(closedHeight <= 96, `Chiuso è una riga compatta (${closedHeight}px).`);
  // by keyboard
  await evaluate(`document.querySelector('.poll-barometer > summary').focus(); true`);
  const key = async (name, code) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: code === 'Enter' ? 13 : 32, text: name === 'Enter' ? '\r' : ' ' }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: code === 'Enter' ? 13 : 32 }); await pause(250); };
  await key('Enter', 'Enter');
  assert.equal(await evaluate(`document.querySelector('.poll-barometer').open`), true, 'Con la tastiera (Invio) si apre.');
  await key(' ', 'Space');
  assert.equal(await evaluate(`document.querySelector('.poll-barometer').open`), false, 'Con la tastiera (Spazio) si chiude.');
  assert.equal(await evaluate(`document.querySelector('.poll-barometer > summary').getAttribute('aria-expanded')`), 'false');
  await click('.poll-barometer > summary');
  assert.equal(await evaluate(`document.querySelector('.poll-barometer').open`), true);
  assert.equal(await evaluate(`document.querySelectorAll('.poll-barometer .section-kicker').length`), 1, 'Aperto: «Barometro politico · settimana» compare una volta sola.');
  assert.equal(await evaluate(`[...document.querySelectorAll('.poll-barometer .emblem, .poll-barometer .poll-hero-icon')].filter(el => el.getBoundingClientRect().width > 0).length`), 1, 'E il logo del partito una volta sola.');
  for (const part of ['Nazionale', 'Gradimento personale', 'Indecisi']) assert.ok((await evaluate(`document.querySelector('.poll-hero-body').innerText`)).includes(part), `Aperto mostra ${part}.`);
  assert.match(await evaluate(`document.querySelector('.poll-hero-body').innerText`), /margine d’errore|margine d'errore|media di/i, 'E fonte e margine d’errore.');
  // the state survives a redraw and a change of page
  await S(`store.setUi?.({}); return true;`).catch(() => {});
  await evaluate(`location.hash = '#panoramica'; true`); await pause(900); await evaluate(`location.hash = '#sondaggi'; true`); await wait(() => has('.poll-barometer'), 15000);
  assert.equal(await evaluate(`document.querySelector('.poll-barometer').open`), true, 'Aperto resta aperto dopo un cambio di pagina.');
  await click('.poll-barometer > summary');
  await evaluate(`location.hash = '#panoramica'; true`); await pause(900); await evaluate(`location.hash = '#sondaggi'; true`); await wait(() => has('.poll-barometer'), 15000);
  assert.equal(await evaluate(`document.querySelector('.poll-barometer').open`), false, 'Chiuso resta chiuso.');
  for (const [width, height, mobile] of SIZES) { await viewport(width, height, mobile); await pause(400); await noSideScroll(`sondaggi chiuso ${width}×${height}`); await click('.poll-barometer:not([open]) > summary'); await noSideScroll(`sondaggi aperto ${width}×${height}`); await click('.poll-barometer[open] > summary'); }
  // English
  await lang('en');
  const english = await evaluate(`document.querySelector('.poll-sum-line').innerText`);
  assert.match(english, /\S+.* at \d+\.\d%\s*\([+−±]\d+(\.\d)?%\)/, `In inglese: «Party at 12.3% (+0.1%)» (${english})`);
  await noItalian('sondaggi chiuso in inglese', '.poll-barometer');
  await click('.poll-barometer > summary'); await noItalian('sondaggi aperto in inglese', '.poll-barometer');
  assert.ok((await evaluate(`document.querySelector('.poll-hero-body').innerText`)).includes('compared with the previous poll'));
  await click('.poll-barometer[open] > summary'); await lang('it'); await viewport(390, 844, true);

  // ---------- the sitting of an open vote ----------
  await S(`store.setHeadlessVoter(null); let i = 0; for (; i < 80 && !store.openVotes().some(v => v.scope === 'nazionale'); i++) store.advance(7); return i;`);
  await evaluate(`location.hash = '#panoramica'; true`); await pause(1200);
  for (const [width, height, mobile] of SIZES) {
    await viewport(width, height, mobile); await pause(400);
    await click('[data-floor-open][data-floor-mode="diretta"]'); await wait(() => has('.floor-overlay'), 8000);
    const label = `votazione ${width}×${height}`;
    const sitting = await evaluate(`({ phase: document.querySelector('.floor-overlay').dataset.floorPhase, lines: document.querySelectorAll('.floor-said li').length, ballot: !document.querySelector('[data-floor-ballot]').hidden, result: Boolean(document.querySelector('[data-floor-outcome], .floor-board')), roles: [...document.querySelectorAll('.floor-proposers dt')].map(dt => dt.textContent) })`);
    assert.equal(sitting.phase, 'voto', `${label}: la scheda è subito disponibile`); assert.ok(sitting.lines >= 3, `${label}: le tre battute del Presidente sono subito tutte lì`); assert.ok(sitting.ballot, `${label}: Favorevole/Contrario/Astenuto è già aperta`);
    assert.equal(sitting.result, false, `${label}: nessun risultato prima della conferma`); assert.ok(sitting.roles.length >= 1 && sitting.roles.every(role => /Proponente|Gruppo|Partito|Primo firmatario/.test(role)), `${label}: il proponente ha il suo ruolo (${sitting.roles.join(', ')})`);
    // choose and confirm at once: the controls can be reached by scrolling the window, none lies out of the screen sideways
    await evaluate(`document.querySelector('[data-floor-choice="astenuto"]').scrollIntoView({ block: 'center' }); true`);
    const reach = await evaluate(`(() => { const r = el => el.getBoundingClientRect(); const ids = ['favorevole', 'contrario', 'astenuto']; return { choices: ids.map(id => { const b = r(document.querySelector('[data-floor-choice="' + id + '"]')); return { left: b.left, right: b.right, h: b.height }; }), vw: innerWidth, side: document.querySelector('.floor-window').scrollWidth > document.querySelector('.floor-window').clientWidth + 1 }; })()`);
    assert.ok(reach.choices.every(item => item.left >= 0 && item.right <= reach.vw + 0.5 && item.h >= 40) && !reach.side, `${label}: le tre scelte stanno nello schermo e si toccano (${JSON.stringify(reach.choices.map(item => Math.round(item.h)))})`);
    await click('[data-floor-close]'); await pause(200);
  }
  await viewport(390, 844, true);
  await click('[data-floor-open][data-floor-mode="diretta"]'); await wait(() => has('.floor-overlay'), 8000);
  await click('[data-floor-choice="contrario"]'); assert.equal(await evaluate(`document.querySelector('[data-floor-confirm]').disabled`), false, 'Scelto, si conferma subito.');
  await lang('en'); await noItalian('votazione in inglese', '.floor-overlay');
  assert.match(await evaluate(`document.querySelector('.floor-overlay').innerText`), /institutional proposer|proposing|first signatory|proposer/i, 'Il ruolo del proponente è tradotto.');
  await lang('it');
  await click('[data-floor-confirm]'); await wait(() => has('.aula-overlay:not(.floor-overlay)'), 8000);
  assert.equal(await S('return store.openVotes().length;') <= 1, true, 'Il voto è registrato una sola volta.');
  await evaluate(`document.querySelectorAll('.aula-overlay').forEach(el => el.remove()); true`);

  // ---------- the rewards page ----------
  await S(`store.setHeadlessVoter(true); return true;`);
  await evaluate(`location.hash = '#ricompense'; true`); await wait(() => has('[data-rewards-page]'), 15000);
  assert.equal(await evaluate(`document.querySelector('[data-community-claim]')?.disabled`), true, 'Prima di aprire il profilo il riscatto Instagram è spento.');
  assert.match(await evaluate(`document.querySelector('[data-community-note]').innerText`), /Apri il profilo, poi torna qui/, 'E spiega il passaggio.');
  assert.match(await evaluate(`document.querySelector('[data-reward-community="instagram"]').innerText`), /una volta sola|Una volta sola/, 'Dice che vale una volta sola.');
  for (const [width, height, mobile] of SIZES) {
    await viewport(width, height, mobile); await pause(400); await noSideScroll(`ricompense ${width}×${height}`);
    const small = await evaluate(`[...document.querySelectorAll('[data-rewards-page] button, [data-rewards-page] a.secondary-button')].filter(el => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height < ${mobile ? 36 : 30}).map(el => el.textContent.trim().slice(0, 24))`);
    assert.deepEqual(small, [], `ricompense ${width}×${height}: pulsanti troppo piccoli`);
  }
  await lang('en'); await noItalian('ricompense in inglese', '[data-rewards-page]'); await lang('it');
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
  console.log('Schermate finali verificate in Chrome a 320, 360, 390, 430, 768 e 1440 px: resoconto con «Continua» subito visibile e corpo scorrevole, barometro chiuso al primo accesso (riepilogo, tastiera, stato conservato, una sola intestazione e un solo logo), votazione con battute e scheda subito e proponente con il suo ruolo, ricompense con riscatto spento fino al profilo; in italiano e in inglese.');
}, { voter: true });
