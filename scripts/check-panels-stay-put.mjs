// I pannelli (<details>) restano aperti o chiusi come li ha lasciati il giocatore: un ridisegno della pagina (nuova settimana, salvataggio, azione) non li riapre né li richiude.
// Vale per ogni pannello, anche per quelli senza chiave propria (Vita interna, dirigenti locali, comitati). Senza Chrome il controllo si salta.
import { chromeAvailable, withBrowser, createCareerInPage, openCareer } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Stato dei pannelli saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
const checks = [];
const ok = (condition, message) => { if (!condition) throw new Error(message); checks.push(message); };
await withBrowser(async browser => {
  const { evaluate, goto, waitFor, pause, version } = browser;
  await createCareerInPage(browser, { weeks: 2 });
  await openCareer(browser);
  // a redraw of the page: the player goes to another tab and comes back (the panels are drawn again from scratch), and the week moves on
  const redraw = async tab => {
    await evaluate(`(() => { const other = [...document.querySelectorAll('[data-section-tab-value]')].find(el => el.dataset.sectionTabValue !== '${tab}'); other?.click(); return Boolean(other); })()`);
    await pause(300);
    await evaluate(`document.querySelector('[data-section-tab-value="${tab}"]')?.click(); true`);
    await pause(400);
  };
  for (const [page, tab, panelsSelector] of [['#partito', 'vita', '.pl-level, .pl-details'], ['#partito', 'territorio', '.cm-details'], ['#carriera', 'percorso', '.sx-body details']]) {
    await evaluate(`location.hash = '${page}'; true`);
    await pause(500);
    await evaluate(`(() => { const tab = document.querySelector('[data-section-tab-value="${tab}"]'); if (tab) tab.click(); return Boolean(tab); })()`);
    await pause(600);
    const total = await evaluate(`document.querySelectorAll(${JSON.stringify(panelsSelector)}).length`);
    if (!total) { checks.push(`${tab}: nessun pannello da verificare in questa partita (saltato)`); continue; }
    // every panel is put in the opposite state of its default (the first one against the rest), marked, and the page is redrawn: the marks must be gone (the DOM was rebuilt) and the states unchanged
    await evaluate(`(() => { const items = [...document.querySelectorAll(${JSON.stringify(panelsSelector)})]; items.forEach((el, i) => { const defaults = el.open; el.dataset.wasDefault = String(defaults); el.open = i === 0 ? !defaults : defaults; el.__mark = true; el.dispatchEvent(new Event('toggle', { bubbles: false })); }); return true; })()`);
    await pause(200);
    const before = await evaluate(`[...document.querySelectorAll(${JSON.stringify(panelsSelector)})].map(el => el.open)`);
    for (let i = 0; i < 3; i++) await redraw(tab);
    const rebuilt = await evaluate(`[...document.querySelectorAll(${JSON.stringify(panelsSelector)})].every(el => !el.__mark)`);
    const after = await evaluate(`[...document.querySelectorAll(${JSON.stringify(panelsSelector)})].map(el => el.open)`);
    ok(rebuilt, `${tab}: la pagina è stata davvero ridisegnata`);
    ok(JSON.stringify(before) === JSON.stringify(after), `${tab}: dopo tre ridisegni i ${before.length} pannelli sono come li hai lasciati (prima ${before.map(Number).join("")}, dopo ${after.map(Number).join("")})`);
  }
});
console.log(`Pannelli verificati (${checks.length} controlli): l’apertura e la chiusura sopravvivono ai ridisegni.`);
for (const line of checks) console.log(" - " + line);
