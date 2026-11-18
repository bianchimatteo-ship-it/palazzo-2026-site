// The identity block of the wizard (date of birth in three fields + gender) in a real browser, at the widths of phones, tablets and desktop: nothing cut or overlapped, the fields side by side on the
// whole row, the month menu usable, typing / pasting / autofill working, and the other fields kept when the gender or the date change. Screenshots in docs/qa/screenshots/final.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromeAvailable, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.error('SKIPPED: Chrome non trovato (imposta CHROME_PATH).'); process.exit(process.env.REQUIRE_CHROME ? 1 : 0); }
const WIDTHS = [320, 360, 375, 390, 430, 768, 820, 1280];
const OUT = new URL('../docs/qa/screenshots/final/', import.meta.url).pathname; await mkdir(OUT, { recursive: true });
await withBrowser(async b => {
  const { evaluate, viewport, goto, waitFor, pause, screenshot } = b;
  const set = (sel, value, events = ['input', 'change']) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(value)}; for (const e of ${JSON.stringify(events)}) el.dispatchEvent(new Event(e, { bubbles: true })); return true; })()`);
  const val = sel => evaluate(`document.querySelector(${JSON.stringify(sel)})?.value`);
  await goto(); await evaluate(`localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true })), true`);
  for (const width of WIDTHS) {
    await viewport(width, width < 500 ? 820 : 1000); await goto();
    await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu=nuova]"))')); await pause(1200);
    await evaluate('document.querySelector("[data-menu=nuova]").click(), true'); await waitFor(() => evaluate('Boolean(document.querySelector("[data-wizard-mode=realistica]"))'));
    await evaluate(`document.querySelector('[data-wizard-mode="realistica"]').click(), true`); await waitFor(() => evaluate('Boolean(document.querySelector("[name=birthDay]"))')); await pause(400);
    const geo = await evaluate(`(() => { const r = sel => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, sw: e.scrollWidth, cw: e.clientWidth }; };
      return { field: r('.birth-field'), day: r('[name=birthDay]'), month: r('[name=birthMonth]'), year: r('[name=birthYear]'), gender: r('[name=gender]'), grid: r('.wizard-profile .wizard-form-grid'), docW: document.documentElement.scrollWidth, vw: innerWidth,
        labels: [...document.querySelectorAll('.birth-row label')].map(l => { const b = l.getBoundingClientRect(); return { w: b.width, clipped: l.scrollWidth > l.clientWidth + 1 }; }) }; })()`);
    const at = `${width}px`;
    assert.ok(geo.docW <= geo.vw + 1, `${at}: nessuno scorrimento orizzontale della pagina (${geo.docW} > ${geo.vw}).`);
    assert.ok(geo.field.w >= geo.grid.w * 0.95, `${at}: la data di nascita occupa tutta la riga (${Math.round(geo.field.w)} di ${Math.round(geo.grid.w)}).`);
    assert.ok(geo.day.r <= geo.month.l + 1 && geo.month.r <= geo.year.l + 1, `${at}: giorno, mese e anno sono affiancati senza sovrapporsi.`);
    for (const f of [geo.day, geo.month, geo.year]) assert.ok(f.l >= geo.field.l && f.r <= geo.field.r && f.t >= geo.field.t && f.b <= geo.field.b, `${at}: i campi stanno dentro il blocco.`);
    assert.ok(geo.day.w >= 50 && geo.year.w >= 62 && geo.month.w >= 100, `${at}: i campi sono abbastanza larghi per leggere il valore (g ${Math.round(geo.day.w)}, m ${Math.round(geo.month.w)}, a ${Math.round(geo.year.w)}).`);
    for (const [k, f] of Object.entries({ day: geo.day, month: geo.month, year: geo.year, gender: geo.gender })) assert.ok(f.b - f.t >= 44, `${at}: altezza di tocco di almeno 44 px (${k} ${Math.round(f.b - f.t)}).`);
    assert.ok(geo.labels.every(l => !l.clipped), `${at}: etichette non tagliate.`);
    assert.ok(geo.gender.b > geo.field.b - 1, `${at}: il genere sta sotto la data, non sovrapposto.`);
    // typing, month menu, gender and the date do not wipe the other fields
    await set('[name=firstName]', 'Anna'); await set('[name=lastName]', 'Verdi');
    await set('[name=birthDay]', '29'); await set('[name=birthMonth]', '2'); await set('[name=birthYear]', '1985');
    assert.match(await evaluate('document.querySelector("[data-birth-hint]").textContent'), /bisestile|esiste|29|valid/i, `${at}: il 29 febbraio 1985 (non bisestile) è segnalato.`);
    assert.equal(await val('[name=birthDate]'), '', `${at}: nessuna data ISO per una data impossibile.`);
    await set('[name=birthYear]', '1984');
    assert.equal(await val('[name=birthDate]'), '1984-02-29', `${at}: 29 febbraio 1984 (bisestile) è valido.`);
    await set('[name=gender]', 'donna');
    assert.equal(await val('[name=firstName]'), 'Anna', `${at}: cambiare genere non cancella il nome.`); assert.equal(await val('[name=birthDate]'), '1984-02-29', `${at}: né la data.`);
    await set('[name=birthDay]', '12/04/1985');
    assert.deepEqual([await val('[name=birthDay]'), await val('[name=birthMonth]'), await val('[name=birthYear]'), await val('[name=birthDate]')], ['12', '4', '1985', '1985-04-12'], `${at}: una data incollata nel campo giorno riempie i tre campi.`);
    await set('[name=birthDate]', '1990-11-03');
    assert.deepEqual([await val('[name=birthDay]'), await val('[name=birthMonth]'), await val('[name=birthYear]')], ['3', '11', '1990'], `${at}: l'autofill del campo nascosto riempie i campi visibili.`);
    assert.equal(await val('[name=lastName]'), 'Verdi', `${at}: il cognome resta.`);
    const monthOptions = await evaluate('document.querySelector("[name=birthMonth]").options.length');
    assert.equal(monthOptions, 13, `${at}: il menu dei mesi ha tutti i dodici mesi.`);
    // going to the next step and back keeps everything
    await evaluate('document.querySelector(".wizard-footer [data-wizard-action=next]").click(), true'); await pause(500);
    await evaluate('document.querySelector(".wizard-footer [data-wizard-action=back], [data-wizard-action=back]")?.click(), true'); await waitFor(() => evaluate('Boolean(document.querySelector("[name=birthDay]"))')); await pause(300);
    assert.deepEqual([await val('[name=firstName]'), await val('[name=birthDate]'), await val('[name=gender]')], ['Anna', '1990-11-03', 'donna'], `${at}: passando al passaggio dopo e tornando indietro i dati restano.`);
    await screenshot(`${OUT}wizard-identita-${width}.png`);
  }
}, { language: 'it' });
console.log(`Blocco identità del wizard verificato in Chrome a ${WIDTHS.join(', ')} px: campi affiancati e leggibili, nessun taglio, data incollata e autofill, bisestili, dati conservati; screenshot in docs/qa/screenshots/final.`);
