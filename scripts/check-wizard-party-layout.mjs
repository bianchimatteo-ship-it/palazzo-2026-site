// Creazione del partito (Nuova partita → Partito → «Crea un nuovo partito»): anteprima e comandi del logo, programma e posizioni stanno in sezioni separate, senza sovrapporsi e senza
// scorrimento orizzontale, su desktop e su telefono. La regressione: il contenitore del logo condivideva la classe «wizard-logo» con il marchio del gioco (88 × 88 px) e schiacciava il resto.
// Senza Chrome il controllo si salta con un messaggio.
import { chromeAvailable, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Layout della creazione del partito saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
const checks = [];
const ok = (condition, message) => { if (!condition) throw new Error(message); checks.push(message); };
await withBrowser(async ({ evaluate, viewport, goto, waitFor, pause, version }) => {
  for (const [label, width, height] of [['desktop', 1280, 900], ['telefono', 375, 760], ['telefono stretto', 320, 700]]) {
    await viewport(width, height, width < 800);
    await goto();
    await evaluate(`localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true })), true`);
    await goto();
    await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu], .main-menu, .language-gate"))'));
    await pause(800);
    await evaluate(`(async () => {
      const { store } = await import('/src/core/store.js?v=${version}');
      const wizard = await import('/src/ui/career-wizard.js?v=${version}');
      const draft = { ...wizard.makeCareerDraft('2026-10-12'), step: 3, partyMode: 'new', partyName: 'Partito di prova con un nome molto lungo', partyAbbreviation: 'PPL', partyColor: '#264d82', startingRole: null, region: 'Toscana', municipality: 'Siena' };
      document.querySelector('#app').innerHTML = wizard.renderCareerWizard(store.getState(), draft, [], () => null, [], [], [], [], null);
      return true;
    })()`);
    await pause(300);
    const report = await evaluate(`(() => {
      const box = selector => { const el = document.querySelector(selector); if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
      const overlap = (a, b) => a && b && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
      const body = document.querySelector('.wizard-body');
      const builder = box('.wizard-logo-builder'), preview = box('.wizard-logo-preview'), controls = box('.wizard-logo-controls'), program = box('.wizard-program-section'), logoSection = box('.wizard-logo-section');
      const form = box('.new-party-form');
      return {
        found: Boolean(builder && preview && controls && program),
        scrollsSideways: body ? body.scrollWidth > body.clientWidth + 1 : null,
        pageScrollsSideways: document.documentElement.scrollWidth > window.innerWidth + 1,
        builderSize: builder ? [Math.round(builder.width), Math.round(builder.height)] : null,
        previewControlsOverlap: overlap(preview, controls), logoProgramOverlap: overlap(logoSection, program), builderProgramOverlap: overlap(builder, program),
        controlsInside: controls && builder ? controls.right <= builder.right + 1 && controls.left >= builder.left - 1 : false,
        logoBeforeProgram: logoSection && program ? logoSection.bottom <= program.top + 1 : false,
        fieldsInside: form ? [...document.querySelectorAll('.new-party-form input, .new-party-form select, .new-party-form textarea')].every(el => { const r = el.getBoundingClientRect(); return r.width === 0 || (r.right <= form.right + 1 && r.left >= form.left - 1); }) : false,
        brandSize: box('.wizard-brand .wizard-logo') ? Math.round(box('.wizard-brand .wizard-logo').width) : null
      };
    })()`);
    ok(report.found, `${label}: logo, comandi e programma sono presenti`);
    ok(report.builderSize[0] > 200, `${label}: il blocco del logo ha una larghezza utile (${report.builderSize[0]} px), non 88 px come il marchio del gioco`);
    ok(!report.previewControlsOverlap, `${label}: l’anteprima del logo non copre i comandi`);
    ok(!report.logoProgramOverlap && !report.builderProgramOverlap && report.logoBeforeProgram, `${label}: il programma sta sotto il logo, in una sezione separata`);
    ok(report.controlsInside && report.fieldsInside, `${label}: comandi e campi restano dentro il modulo`);
    ok(report.scrollsSideways === false && !report.pageScrollsSideways, `${label}: nessuno scorrimento orizzontale`);
    ok(report.brandSize === null || report.brandSize <= 100, `${label}: il marchio del gioco resta piccolo (${report.brandSize} px)`);
  }
});
console.log(`Creazione del partito verificata su desktop e telefono (${checks.length} controlli): logo, programma e posizioni separati, nessuna sovrapposizione né scorrimento orizzontale.`);
