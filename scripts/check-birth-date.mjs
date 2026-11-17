// The date of birth in three simple fields: the calendar (30 and 31 days, leap years), the future, a plausible age, the same «YYYY-MM-DD» for the game and the old saves, and in Chrome on a phone: numeric keyboards,
// the hidden field follows what is typed, mistakes are told in words.
import assert from 'node:assert/strict';
import { daysInMonth, isLeapYear, parseBirth, parseTyped, splitBirth } from '../src/core/birth-date.js';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';

assert.ok(isLeapYear(2000) && isLeapYear(2024) && !isLeapYear(1900) && !isLeapYear(2023), 'anni bisestili: secolari solo se divisibili per 400');
assert.deepEqual([daysInMonth(2024, 2), daysInMonth(2023, 2), daysInMonth(2023, 4), daysInMonth(2023, 12)], [29, 28, 30, 31]);
const today = '2026-09-24';
assert.deepEqual(parseBirth({ day: '12', month: '4', year: '1985' }, today), { iso: '1985-04-12', age: 41, error: null }, 'data valida: stesso formato di sempre');
assert.equal(parseBirth({ day: '29', month: '2', year: '2000' }, today).iso, '2000-02-29', '29 febbraio di un anno bisestile');
assert.match(parseBirth({ day: '29', month: '2', year: '2001' }, today).error, /non è un anno bisestile/);
assert.match(parseBirth({ day: '31', month: '4', year: '1985' }, today).error, /Aprile ha 30 giorni/);
assert.match(parseBirth({ day: '0', month: '4', year: '1985' }, today).error, /almeno 1/);
assert.match(parseBirth({ day: '12', month: '13', year: '1985' }, today).error, /mese/);
assert.match(parseBirth({ day: '12', month: '4', year: '1850' }, today).error, /1900/);
assert.match(parseBirth({ day: '12', month: '4', year: '2030' }, today).error, /futuro/);
assert.match(parseBirth({ day: '12', month: '4', year: '1900' }, '2026-09-24').error ?? '', /110/, 'oltre i 110 anni: controlla l’anno');
assert.match(parseBirth({ day: 'ab', month: '4', year: '1985' }, today).error, /cifre/);
assert.equal(parseBirth({ day: '12', month: '4', year: '19' }, today).unfinished, true, 'a metà non è un errore, è incompleta');
assert.equal(parseBirth({ day: '', month: '', year: '' }, today).empty, true);
assert.equal(parseBirth({ day: '24', month: '9', year: '2026' }, today).age, 0, 'nato oggi: zero anni');
assert.equal(parseBirth({ day: '25', month: '9', year: '1985' }, today).age, 40, 'il compleanno non è ancora arrivato');
assert.deepEqual(splitBirth('1985-04-02'), { day: '2', month: '4', year: '1985' }, 'una vecchia data si divide nei tre campi');
assert.deepEqual(splitBirth(''), { day: '', month: '', year: '' });

// formats typed or pasted in one go
for (const [text, want] of [['12/04/1985', '1985-04-12'], ['12-4-1985', '1985-04-12'], ['12.04.1985', '1985-04-12'], ['1985-04-12', '1985-04-12'], ['12 aprile 1985', '1985-04-12'], ['29/02/2000', '2000-02-29']]) { const t = parseTyped(text); assert.equal(parseBirth(t, today).iso, want, `«${text}» → ${want}`); }
assert.equal(parseTyped('12/04/85'), null, 'Anno a due cifre: non si indovina.'); assert.equal(parseTyped('ciao'), null);
assert.equal(parseBirth(parseTyped('31/04/1985'), today).iso, '', 'Il 31 aprile incollato è rifiutato.');
if (!chromeAvailable) { console.log('Data di nascita: parte nel browser saltata (Chrome non trovato).'); } else {
  await withBrowser(async browser => {
    const { evaluate, goto, waitFor: wait, pause, send, errors } = browser;
    await createCareerInPage(browser, {});
    await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
    await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu=nuova]:not([disabled])"))'));
    await evaluate(`document.querySelector('[data-menu=nuova]:not([disabled])').click(); true`); await pause(600);
    await evaluate(`document.querySelector('[data-wizard-mode="realistica"]')?.click(); true`);
    await wait(() => evaluate('Boolean(document.querySelector("[data-birth]"))'));
    const box = await evaluate(`(() => { const f = document.querySelector('[data-birth]'); const r = f.getBoundingClientRect(); return { inputmode: [...f.querySelectorAll('input[inputmode]')].map(i => i.inputMode), selects: f.querySelectorAll('select').length, width: r.width, over: document.documentElement.scrollWidth > innerWidth + 1 }; })()`);
    assert.deepEqual(box.inputmode, ['numeric', 'numeric'], 'Giorno e anno aprono la tastiera numerica.');
    assert.equal(box.selects, 1, 'Il mese è un menu.'); assert.ok(!box.over && box.width <= 360, 'Nessuno scorrimento orizzontale a 360 px.');
    const type = async (name, value, event = 'input') => evaluate(`(() => { const f = document.querySelector('[data-birth] [name=${name}]'); f.value = ${JSON.stringify(value)}; f.dispatchEvent(new Event('${event}', { bubbles: true })); return true; })()`);
    const read = () => evaluate(`({ hidden: document.querySelector('[data-birth] [name=birthDate]').value, hint: document.querySelector('[data-birth-hint]').textContent, error: document.querySelector('[data-birth-hint]').classList.contains('is-error') })`);
    await type('birthDay', '29'); await type('birthMonth', '2', 'change'); await type('birthYear', '2001');
    let out = await read();
    assert.equal(out.hidden, '', 'Una data che non esiste non arriva al gioco'); assert.ok(out.error && /bisestile/.test(out.hint), out.hint);
    await type('birthYear', '2000'); out = await read();
    assert.equal(out.hidden, '2000-02-29'); assert.ok(!out.error && /Hai \d+ anni/.test(out.hint), out.hint);
    await type('birthDay', '12/04/1985'); out = await read(); assert.equal(out.hidden, '1985-04-12', 'Una data incollata intera riempie i tre campi.'); assert.equal(await evaluate(`document.querySelector('[data-birth] [name=birthYear]').value`), '1985'); assert.equal(await evaluate(`document.querySelector('[data-birth] [name=birthMonth]').value`), '4');
    await type('birthDay', '1x2'); assert.equal(await evaluate(`document.querySelector('[data-birth] [name=birthDay]').value`), '12', 'Solo cifre nel giorno');
    assert.deepEqual(errors.filter(item => !/favicon/.test(String(item))), [], 'Nessun errore JavaScript.');
  });
}
console.log('check-birth-date: ok');
