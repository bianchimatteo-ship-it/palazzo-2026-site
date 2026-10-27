// The first minutes of a first installation, in Chrome against the local Worker (isolated stand-ins, nothing real), once in English and once in Italian:
//   1. the language comes first (both languages on the screen, the logo, two buttons) — before any account screen or menu, and nothing is saved until the player chooses;
//   2. the account screen that already exists, entirely in the chosen language, with the existing registration (nothing of the authentication changes);
//   3. the home, in that language, with no tour or pop-up in between;
//   and the language is kept in politicando.settings.v1 (the Italian default too), survives a restart, and the Italiano/English selector on the home changes it later.
import assert from 'node:assert/strict';
import { chromeAvailable, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Flusso della lingua nel browser saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
globalThis.location = new URL('http://127.0.0.1:8791/');
const { startLocalWorker } = await import('./lib/local-worker.mjs');
const local = await startLocalWorker({ port: 8791 });

const ITALIAN = new Set('il lo la le gli un una uno di del della dei delle al alla dal nel nella sul sulla per con che non sono come più tra fra sei hai puoi questa questo quando dove cosa senza ogni è già può così del dello degli'.split(' '));
const italianWords = text => (text.toLowerCase().match(/[a-zà-ù']+/g) ?? []).filter(word => ITALIAN.has(word));

async function flow(language, { account }) {
  await withBrowser(async ({ evaluate, waitFor, pause, goto, errors }) => {
    const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    const click = async selector => { const ok = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`); assert.ok(ok, `manca ${selector}`); await pause(400); };
    const stored = () => evaluate(`JSON.parse(localStorage.getItem('politicando.settings.v1') || 'null')`);
    const visible = () => evaluate(`document.body.innerText`);
    const english = language === 'en';

    // ---------- 1. the first screen: the language, before everything ----------
    assert.ok(await has('.language-gate'), `${language}: la prima schermata è la scelta della lingua.`);
    const gate = await evaluate(`(() => { const gate = document.querySelector('.language-gate'); return { text: gate.innerText, buttons: [...gate.querySelectorAll('button')].map(button => button.dataset.languageChoice + ':' + button.innerText.replace(/\\s+/g, ' ').trim()), logoLoaded: (() => { const img = gate.querySelector('img'); return Boolean(img && img.complete && img.naturalWidth > 0); })(), others: document.querySelectorAll('[data-menu], [data-account-form], .menu-new').length }; })()`);
    for (const phrase of ['Scegli la lingua', 'Choose your language', 'Seleziona una lingua per continuare', 'Select a language to continue']) assert.ok(gate.text.includes(phrase), `${language}: la schermata dice «${phrase}».`);
    assert.deepEqual(gate.buttons.map(item => item.replace(/\s+/g, ' ')), ['it:🇮🇹 Italiano', 'en:🇬🇧 English'], `${language}: due pulsanti, Italiano e English.`);
    assert.ok(gate.logoLoaded, `${language}: il logo di POLITICANDO 2026 è caricato.`);
    assert.equal(gate.others, 0, `${language}: nessun menu né schermata di account prima della lingua.`);
    assert.equal(await stored(), null, `${language}: finché non sceglie nulla viene salvato.`);
    assert.equal(await evaluate('document.documentElement.lang'), 'it', `${language}: prima della scelta la lingua di pagina è quella predefinita.`);

    // ---------- 2. the account screen, in the chosen language ----------
    await click(`[data-language-choice="${language}"]`);
    await waitFor(() => has('.main-menu'));
    assert.equal((await stored())?.language, language, `${language}: la lingua è salvata in politicando.settings.v1.`);
    assert.equal(await evaluate('document.documentElement.lang'), language);
    assert.ok(!(await has('.language-gate')), `${language}: la schermata della lingua sparisce.`);
    await waitFor(() => has('.menu-popup-backdrop [data-menu="account"][data-account-mode="register"]'));
    const welcome = await visible();
    assert.ok(english ? /Before you start/i.test(welcome) && !/Prima di iniziare/.test(welcome) : /Prima di iniziare/.test(welcome), `${language}: la schermata dell’account è nella lingua scelta.`);
    const leftovers = italianWords(await evaluate(`document.querySelector('.menu-popup, .menu-popup-backdrop, .main-menu')?.innerText ?? ''`).then(text => text.replace(/Italiano|English/g, '')));
    if (english) assert.deepEqual(leftovers, [], 'en: nessuna parola italiana nella schermata dell’account.');
    assert.ok(await has('[data-menu="account"][data-account-mode="login"]'), `${language}: il sistema di account esistente è quello mostrato (crea un account / accedi).`);
    if (account) {
      await click('.menu-popup-backdrop [data-menu="account"][data-account-mode="register"]');
      await waitFor(() => has('[data-account-form="register"]'));
      if (english) { const form = italianWords((await evaluate(`document.querySelector('.menu-popup')?.innerText ?? ''`)).replace(/Italiano|English/g, '')); assert.deepEqual(form, [], 'en: nessuna parola italiana nel modulo di registrazione.'); }
      await evaluate(`(() => { const form = document.querySelector('[data-account-form="register"]'); form.username.value = 'prova.${language}'; form.password.value = 'password-lunga'; form.confirm.value = 'password-lunga'; form.ageBand.value = 'adult14'; form.requestSubmit(); return true; })()`);
      await waitFor(() => evaluate(`Boolean(JSON.parse(localStorage.getItem('politicando.account.v1') || 'null'))`));

      // ---------- 3. the home, in that language, with nothing in between ----------
      await waitFor(() => evaluate(`!document.querySelector('.menu-popup-backdrop') && Boolean(document.querySelector('.main-menu'))`));
      await pause(700);
      const home = await evaluate(`({ popup: Boolean(document.querySelector('.menu-popup-backdrop')), tour: /COME FUNZIONA|HOW IT WORKS/i.test(document.body.innerText), wizard: Boolean(document.querySelector('.career-wizard')), text: document.body.innerText, selector: document.querySelectorAll('.menu-lang button').length })`);
      assert.ok(!home.popup && !home.tour && !home.wizard, `${language}: dopo l’account c’è la home, senza tour, popup o passaggi in più.`);
      assert.equal(home.selector, 2, `${language}: il selettore Italiano/English è sulla home.`);
      assert.ok(english ? /week after week/i.test(home.text) && !/settimana dopo settimana/.test(home.text) : /settimana dopo settimana/.test(home.text), `${language}: la home è nella lingua scelta.`);
    }

    // ---------- restart: the language stays, the first screen does not come back ----------
    await goto();
    await waitFor(() => has('.main-menu'));
    assert.ok(!(await has('.language-gate')), `${language}: al riavvio la scelta non si ripete.`);
    assert.equal((await stored())?.language, language, `${language}: la lingua resta salvata dopo il riavvio.`);
    assert.equal(await evaluate('document.documentElement.lang'), language, `${language}: e applicata.`);
    const after = await visible();
    assert.ok(english ? !/La politica italiana, settimana dopo settimana/.test(after) : /settimana dopo settimana/.test(after) || /Prima di iniziare/.test(after), `${language}: i testi restano nella lingua scelta.`);

    // ---------- the selector on the home changes it later, and the change is kept too ----------
    const other = english ? 'it' : 'en';
    await evaluate(`document.querySelectorAll('.menu-popup-backdrop [data-menu-close], .menu-popup-x').forEach(button => button.click()), true`);
    await pause(300);
    await click(`.menu-lang [data-setting-value="${other}"]`);
    await waitFor(() => evaluate(`document.documentElement.lang === ${JSON.stringify(other)}`));
    assert.equal((await stored())?.language, other, `${language}: dal selettore si cambia lingua e si salva.`);
    await goto();
    await waitFor(() => has('.main-menu'));
    assert.equal(await evaluate('document.documentElement.lang'), other, `${language}: anche il cambio resta dopo il riavvio.`);
    assert.ok(!(await has('.language-gate')));
    assert.deepEqual(errors, [], `${language}: nessun errore nella pagina.`);
  }, { serverPort: 8791 });
}

await flow('en', { account: true });
await flow('it', { account: true });
console.log('Flusso iniziale in Chrome, in inglese e in italiano: la lingua precede ogni schermata di account (testi bilingui, logo, due pulsanti, nulla salvato prima della scelta), l’account esistente e la registrazione nella lingua scelta, poi la home senza tour né popup; lingua salvata in politicando.settings.v1, ricordata al riavvio e cambiabile dal selettore.');
process.exit(0);
