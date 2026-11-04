// An independent audit of the English interface in a real browser (Chrome): careers of every level are created, played on and walked page by page, tab by tab, with every folded block opened and
// every safe button pressed; every text a person can read or hear (text nodes, options, SVG text, tooltips, accessible names, placeholders, button values, document title) is analysed with the independent
// detector (scripts/lib/i18n-independent.mjs), which does not rely on the phrase book to decide what is Italian. Result: AUDIT_OUT (json) and a summary; exit 1 when something is left in Italian.
//   AUDIT_LEVELS=deputato,comunale   AUDIT_WEEKS=12,150   AUDIT_CLICKS=1|0   AUDIT_OUT=file
import { writeFileSync } from 'node:fs';
import { withBrowser, createCareerInPage, openCareer, chromeAvailable } from './lib/browser.mjs';
import { COLLECT, PAGES, tourCareer } from './lib/i18n-tour.mjs';
import { createIndependentDetector } from './lib/i18n-independent.mjs';

if (!chromeAvailable) { console.log('Audit dell’interfaccia saltato: Chrome non trovato (imposta CHROME_PATH).'); process.exit(process.env.AUDIT_REQUIRE_CHROME ? 1 : 0); }
const detector = createIndependentDetector();
const LANG = process.env.AUDIT_LANG === 'it' ? 'it' : 'en';   // the language of the interface under audit (English: leftover Italian; Italian: leftover English)
const levels = (process.env.AUDIT_LEVELS ?? 'deputato,senatore,comunale,regionale,provinciale,europeo').split(',');
const weeksList = (process.env.AUDIT_WEEKS ?? '10,130').split(',').map(Number);
const clicks = process.env.AUDIT_CLICKS !== '0';
const findings = new Map(); // text → { reason, screens:Set }
const analysed = { texts: 0, distinct: new Set(), screens: 0, clicks: 0, areas: new Set() };
const byScreen = {};   // AUDIT_TEXTS: every text of every screen, to compare the Italian and the English run screen by screen (what is identical in both languages is a name, or was not translated)
const record = (screen, texts) => {
  (byScreen[screen] ??= new Set()); for (const text of texts) byScreen[screen].add(text);
  analysed.screens++; analysed.areas.add(screen.split('/')[0]);
  for (const text of texts) {
    analysed.texts++; analysed.distinct.add(text);
    const reason = LANG === 'en' ? detector.reasonOf(text) : detector.reasonOfEnglish(text);
    if (reason) { const item = findings.get(text) ?? { reason, screens: new Set() }; item.screens.add(screen); findings.set(text, item); }
  }
};
const UNSAFE = /delet|elimin|cancell|reset|azzer|logout|esci|sign out|abandon|abband|retire|ritir|leave politics|lascia la politica|end (the )?career|termina|ricominci|new game|nuova partita|clear|wipe|erase|remove account|delete account/i;

await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
  await viewport(1280, 900, false);
  // ---- the opening menu, its pop-ups and the new career (the choice of the mode and the six steps, with every select opened) ----
  try {
    await evaluate(`localStorage.clear(); localStorage.setItem('politicando.settings.v1', JSON.stringify({ language: '${LANG}' })); localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true })); true`);
    await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu]"))')); await pause(900);
    record('menu/home', await evaluate(COLLECT));
    for (const view of ['guida', 'impostazioni', 'carica', 'hall', 'loghi', 'account']) {
      await evaluate(`document.querySelector('[data-menu="${view}"]')?.click(); true`); await pause(view === 'loghi' ? 1800 : 700);
      await evaluate(`document.querySelectorAll('.menu-popup details:not([open])').forEach(d => d.setAttribute('open', '')); true`);
      record(`menu/${view}`, await evaluate(COLLECT));
      await evaluate(`document.querySelector('.menu-popup-foot [data-menu-close]')?.click(); true`); await pause(300);
    }
    await evaluate(`document.querySelector('[data-menu="account"]')?.click(); true`); await pause(500);
    for (const mode of ['register', 'recover']) { await evaluate(`document.querySelector('[data-account-mode="${mode}"]')?.click(); true`); await pause(400); record(`menu/account-${mode}`, await evaluate(COLLECT)); }
    await evaluate(`document.querySelector('.menu-popup-foot [data-menu-close]')?.click(); true`); await pause(300);
    await evaluate(`document.querySelector('[data-menu="nuova"]:not([disabled])').click(); true`); await wait(() => evaluate('Boolean(document.querySelector(".wizard-mode-gate"))')); await pause(400);
    record('wizard/modalita', await evaluate(COLLECT));
    await evaluate(`document.querySelector('[data-wizard-mode="sandbox"]').click(); true`); await wait(() => evaluate('Boolean(document.querySelector(".career-wizard [name=firstName]"))')); await pause(400);
    const setField = (selector, value, event = 'input') => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(event)}, { bubbles: true })); return true; })()`);
    const options = async name => { for (const sel of await evaluate(`[...document.querySelectorAll('.career-wizard select')].map(s => [s.name || s.dataset.wizardRegion || '', [...s.options].map(o => o.textContent.replace(/\\s+/g, ' ').trim())])`)) record(`wizard/${name}/select:${sel[0]}`, sel[1]); };
    const nextStep = async () => { await evaluate(`document.querySelector('.wizard-footer [data-wizard-action="next"]').click(); true`); await pause(500); };
    record('wizard/1', await evaluate(COLLECT)); await options('1');
    await setField('.career-wizard [name="firstName"]', 'Anna'); await setField('.career-wizard [name="lastName"]', 'Bianchi'); await setField('.career-wizard [name="birthDate"]', '1985-04-12', 'change');
    await setField('.career-wizard [name="professionChoice"]', 'altro', 'change'); await pause(300); record('wizard/1-altro', await evaluate(COLLECT));
    await setField('.career-wizard [name="professionChoice"]', 'Insegnante', 'change'); await pause(300);
    await nextStep(); await wait(() => evaluate('Boolean(document.querySelector("[data-wizard-region]"))')); record('wizard/2', await evaluate(COLLECT)); await options('2');
    await setField('[data-wizard-region]', 'Toscana', 'change'); await wait(() => evaluate('Boolean(document.querySelector("[data-wizard-municipality-search]"))'));
    await setField('[data-wizard-municipality-search]', 'Siena'); await wait(() => evaluate('Boolean(document.querySelector("[data-municipality-code=\\"052032\\"]"))'));
    await evaluate(`document.querySelector('[data-municipality-code="052032"]').click(); true`); await pause(300);
    await nextStep(); record('wizard/3', await evaluate(COLLECT));
    await evaluate(`document.querySelector('[data-starting-office="presidenteConsiglio"]')?.click(); true`); await pause(300); record('wizard/3-pdc', await evaluate(COLLECT));
    await evaluate(`document.querySelector('[data-level="comunale"]').click(); true`); await pause(300);
    await nextStep(); record('wizard/4', await evaluate(COLLECT)); await options('4');
    await nextStep(); await evaluate(`document.querySelectorAll('.career-wizard details:not([open])').forEach(d => d.setAttribute('open', '')); true`); record('wizard/5', await evaluate(COLLECT)); await options('5');
    await nextStep(); record('wizard/6', await evaluate(COLLECT));
  } catch (error) { console.error(`[audit] menu e wizard: ${String(error.message).slice(0, 200)}`); analysed.failed = (analysed.failed ?? 0) + 1; }
  for (const level of levels) for (const weeks of weeksList) {
    const tag = `${level}@${weeks}w`;
    try {
      await evaluate(`localStorage.clear(); localStorage.setItem('politicando.settings.v1', JSON.stringify({ language: '${LANG}' })); true`);
      await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu], .main-menu"))'));
      await createCareerInPage({ evaluate, version }, { level, group: level === 'senatore' ? 'senato-xix-gruppo-56' : 'cam-xix-03', weeks, region: ['Toscana', 'Lombardia', 'Campania'][weeks % 3], name: ['Anna', 'Bianchi'], onboarding: true });
      await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ language: '${LANG}' })); true`);
      await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))'));
      record(`menu/${tag}`, await evaluate(COLLECT));
      await openCareer({ evaluate, goto, waitFor: wait }); await pause(1200);
      await tourCareer({ evaluate, pause }, { pages: PAGES, onScreen: (name, texts) => record(`${tag}/${name}`, texts) });
      if (clicks) {
        for (const page of PAGES.filter(p => !['archivio'].includes(p))) {
          await evaluate(`location.hash = '#${page}'; true`); await pause(700);
          const labels = await evaluate(`[...document.querySelectorAll('.page-wrap button, .page-wrap [role=button], .page-wrap summary')].filter(b => b.offsetParent !== null && !b.disabled).map((b, i) => [i, (b.textContent || b.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 60)])`);
          for (const [index, label] of labels.slice(0, 40)) {
            if (UNSAFE.test(label)) continue;
            const before = new Set(await evaluate(COLLECT));
            const done = await evaluate(`(() => { const b = [...document.querySelectorAll('.page-wrap button, .page-wrap [role=button], .page-wrap summary')].filter(x => x.offsetParent !== null && !x.disabled)[${index}]; if (!b) return false; b.click(); return true; })()`);
            if (!done) continue;
            analysed.clicks++;
            await pause(260);
            const after = await evaluate(COLLECT);
            record(`${tag}/${page}/click:${label.slice(0, 30)}`, after.filter(text => !before.has(text)));
            // closes whatever opened (dialogs, popups) and goes back to the page
            await evaluate(`(() => { [...document.querySelectorAll('aside button, [role=dialog] button, .modal button, .popup button')].filter(b => /^(Close|Chiudi|Cancel|Annulla|OK|Not now|Later)$/i.test(b.textContent.trim())).forEach(b => b.click()); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true; })()`);
            if ((await evaluate('location.hash')) !== `#${page}`) { await evaluate(`location.hash = '#${page}'; true`); await pause(500); }
          }
        }
      }
      record(`${tag}/settings-final`, await evaluate(COLLECT));
    } catch (error) { console.error(`[audit] ${tag}: ${String(error.message).slice(0, 200)}`); analysed.failed = (analysed.failed ?? 0) + 1; }
  }
  if (errors.length) console.error(`[audit] errori JavaScript nella pagina: ${errors.length} (primo: ${String(errors[0]).slice(0, 200)})`);
});
const rows = [...findings].map(([text, item]) => ({ text, reason: item.reason, screens: [...item.screens].slice(0, 6) })).sort((a, b) => a.reason.localeCompare(b.reason));
if (process.env.AUDIT_TEXTS) writeFileSync(process.env.AUDIT_TEXTS, JSON.stringify(Object.fromEntries(Object.entries(byScreen).map(([k, v]) => [k, [...v]]))));
if (process.env.AUDIT_OUT) writeFileSync(process.env.AUDIT_OUT, JSON.stringify({ analysed: { texts: analysed.texts, distinct: analysed.distinct.size, screens: analysed.screens, clicks: analysed.clicks, areas: [...analysed.areas], failed: analysed.failed ?? 0 }, rows }, null, 1));
console.log(`Audit interfaccia inglese: ${analysed.texts} testi (${analysed.distinct.size} distinti) su ${analysed.screens} schermate/stati, ${analysed.clicks} pulsanti premuti; ${rows.length} testi ancora italiani.`);
for (const row of rows.slice(0, Number(process.env.AUDIT_SHOW ?? 40))) console.log(`  [${row.reason}] ${row.text.slice(0, 140)}  ← ${row.screens[0]}`);
process.exit(rows.length || analysed.failed ? 1 : 0);
