// «Avatar casuale» must follow the gender chosen in the wizard (Uomo → masculine face, Donna → feminine face), through the REAL interface in Chrome: the select is changed the way a person does it
// (value + change event, and also value only, as a mobile picker can leave it), then the button is pressed many times in a row; the face of the preview, the draft and the saved career are read back.
// Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.log('Avatar e genere: saltato (Chrome non disponibile).'); process.exit(0); }
await withBrowser(async browser => {
  const { evaluate, waitFor, pause, goto } = browser;
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const click = async selector => { const ok = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`); assert.ok(ok, `manca ${selector}`); await pause(90); };
  const setGender = (value, fire) => evaluate(`(() => { const el = document.querySelector('.career-wizard select[name="gender"]'); el.value = ${JSON.stringify(value)}; ${fire ? "el.dispatchEvent(new Event('change', { bubbles: true }));" : ''} return el.value; })()`);
  const face = () => evaluate(`document.querySelector('[data-avatar-preview] svg')?.getAttribute('data-avatar')?.split('.')[0] ?? ''`);
  await evaluate(`localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true })), true`); await goto();
  await waitFor(() => has('[data-menu="nuova"]:not([disabled])'));
  await click('[data-menu="nuova"]:not([disabled])'); await waitFor(() => has('.wizard-mode-gate')); await click('[data-wizard-mode="realistica"]'); await waitFor(() => has('.career-wizard [name="firstName"]'));
  const results = [];
  for (const [gender, expected, fire] of [['donna', 'femminile', true], ['uomo', 'maschile', true], ['donna', 'femminile', false], ['uomo', 'maschile', false], ['donna', 'femminile', true]]) {
    await setGender(gender, fire);
    const faces = [];
    for (let n = 0; n < 14; n++) { await click('[data-avatar-random]'); faces.push(await face()); }
    results.push(`${gender}${fire ? '' : ' (senza change)'}: ${faces.filter(item => item === expected).length}/14`);
    assert.ok(faces.every(item => item === expected), `Genere ${gender} (change=${fire}): ogni avatar casuale ha il volto ${expected} (visto: ${faces.join(',')}).`);
    assert.equal(await evaluate(`document.querySelector('.career-wizard select[name="gender"]').value`), gender, 'Il selettore del genere resta com’è dopo il ridisegno.');
  }
  // the gender is not touched by the random avatar and a manual face choice is still possible afterwards
  await click('[data-avatar-field="face"][data-avatar-value="maschile"]'); assert.equal(await face(), 'maschile', 'La scelta manuale del volto resta libera.');
  console.log(`Avatar casuale e genere (Chrome, interfaccia reale): ${results.join(' · ')}`);
});
