// The contact for bugs and proposals: present where the player can reach it (the main menu, the settings, every page of the game, the «Altro» sheet of the phone), a working mailto: with the address and the
// subject asked for, discreet but readable, in both languages, never cut or off screen at 320/360/390/430/768/1440 px, and nothing is sent by the game (no data of the player in the link).
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

const EMAIL = 'politicando2026simulazione@gmail.com', SUBJECT = 'Politicando 2026 - Segnalazione o proposta';
if (!chromeAvailable) { console.log('Contatto per segnalazioni nel browser saltato: Chrome non trovato.'); process.exit(0); }
const SIZES = [[320, 700, true], [360, 800, true], [390, 844, true], [430, 932, true], [768, 1024, true], [1440, 900, false]];
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 3 });
  await openCareer({ evaluate, goto, waitFor: wait });
  const lang = code => evaluate(`import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage(${JSON.stringify(code)})).then(() => true)`).then(() => pause(500));
  const contact = scope => evaluate(`(() => { const root = ${scope ? `document.querySelector(${JSON.stringify(scope)})` : 'document'}; const box = [...(root?.querySelectorAll('[data-support-contact]') ?? [])].find(el => el.getBoundingClientRect().width > 0); if (!box) return null; const a = box.querySelector('a'); const r = box.getBoundingClientRect(), l = a.getBoundingClientRect(); return { href: a.getAttribute('href'), text: box.textContent.replace(/\\s+/g, ' ').trim(), linkText: a.textContent.trim(), left: r.left, right: r.right, width: innerWidth, bottom: r.bottom, height: innerHeight, linkH: l.height, clipped: box.scrollWidth > box.clientWidth + 1, target: a.getAttribute('target') }; })()`);
  const check = (found, where, language) => {
    assert.ok(found, `${where}: il contatto c’è`);
    assert.equal(found.linkText, EMAIL, `${where}: l’indirizzo`);
    const url = new URL(found.href);
    assert.equal(url.protocol, 'mailto:', `${where}: collegamento mailto:`);
    assert.equal(decodeURIComponent(url.pathname), EMAIL, `${where}: destinatario`);
    assert.equal(url.searchParams.get('subject'), SUBJECT, `${where}: oggetto precompilato`);
    assert.equal([...url.searchParams.keys()].join(','), 'subject', `${where}: nessun altro dato nel collegamento`);
    assert.ok(!found.target, `${where}: si apre nell’app di posta, non in una pagina`);
    assert.ok(found.text.startsWith(language === 'en' ? 'Bugs or suggestions? Write to us at' : 'Bug o suggerimenti? Scrivici a'), `${where}: dicitura in ${language}: «${found.text}»`);
    assert.ok(!found.clipped && found.left >= -0.5 && found.right <= found.width + 0.5, `${where}: intero e dentro lo schermo (${Math.round(found.left)}–${Math.round(found.right)} su ${found.width})`);
    assert.ok(found.linkH >= 20, `${where}: collegamento abbastanza alto da toccare (${Math.round(found.linkH)} px)`);
  };
  const scrollToEnd = () => evaluate(`(document.querySelector('.main-area') ?? document.scrollingElement).scrollTo?.(0, 1e6), window.scrollTo(0, 1e6), true`).then(() => pause(250));
  for (const language of ['it', 'en']) {
    await lang(language);
    for (const [width, height, mobile] of SIZES) {
      await viewport(width, height, mobile); await pause(350);
      // every page of the game: the footer
      for (const page of ['panoramica', 'finanze', 'notizie']) {
        await evaluate(`location.hash = ${JSON.stringify('#' + page)}; true`); await pause(500); await scrollToEnd();
        const found = await contact('.app-foot');
        check(found, `${language} ${width}×${height} pagina ${page}`, language);
        assert.ok(found.bottom <= found.height + 1, `${language} ${width}×${height} ${page}: in fondo alla pagina il contatto si vede (sopra la barra inferiore)`);
        assert.equal(await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1'), true, `${language} ${width} ${page}: nessuno scorrimento orizzontale`);
      }
    }
    // the «Altro» sheet of the phone
    await viewport(390, 844, true); await pause(300);
    await evaluate(`document.querySelector('[data-mobile-more]')?.click(); true`); await pause(500);
    check(await contact('#mobile-sheet'), `${language} foglio «Altro»`, language);
    await evaluate(`document.querySelector('[data-mobile-close]')?.click(); true`); await pause(300);
  }
  // settings and main menu
  await lang('it');
  await viewport(390, 844, true);
  await evaluate(`document.querySelector('[data-nav=impostazioni]')?.click(); location.hash = '#impostazioni'; true`); await pause(600);
  await evaluate(`document.querySelector('[data-action=menu]')?.click(); true`); await pause(700);
  check(await contact('.main-menu'), 'menu principale', 'it');
  await evaluate(`document.querySelector('[data-menu=impostazioni]')?.click(); true`); await pause(600);
  check(await contact('.menu-popup'), 'impostazioni', 'it');
  await lang('en');
  check(await contact('.menu-popup'), 'impostazioni in inglese', 'en');
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
  console.log('Contatto per segnalazioni verificato in Chrome (italiano e inglese, 320–1440 px): menu principale, impostazioni, ogni pagina del gioco e foglio «Altro», collegamento mailto: con indirizzo e oggetto, nessun dato del giocatore, mai tagliato né fuori schermo.');
}, { voter: true });
