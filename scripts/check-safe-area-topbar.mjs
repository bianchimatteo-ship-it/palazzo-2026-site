// Safe areas and the top bar, in a real browser with the SAFE AREA EMULATED (CDP Emulation.setSafeAreaInsetsOverride: notch, Dynamic Island, Android status bar, landscape notch). The top bar must start at the very top
// (its background runs under the status bar), its controls must sit below the inset plus the normal padding (once: not doubled, not multiplied by the interface zoom), and its touch targets must be at least 44 (iOS) / 48 (Android)
// CSS px. Home and gameplay use the same bar. Emulated insets are NOT a real iPhone or Android phone: see docs/qa. Chrome; skipped without it.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.log('Safe area e barra superiore: SKIPPED (Chrome non trovato, imposta CHROME_PATH).'); process.exit(0); }
const SHOTS = process.argv.find(item => item.startsWith('--shots='))?.split('=')[1];
const CASES = [
  // [width, height, insets{top,left,right,bottom}, label]
  [320, 700, { top: 24, bottom: 0, left: 0, right: 0 }, 'Android status bar 24'],
  [375, 812, { top: 44, bottom: 34, left: 0, right: 0 }, 'iPhone X notch 44'],
  [390, 844, { top: 47, bottom: 34, left: 0, right: 0 }, 'iPhone 12/13/14 notch 47'],
  [414, 896, { top: 48, bottom: 34, left: 0, right: 0 }, 'iPhone 11 notch 48'],
  [430, 932, { top: 59, bottom: 34, left: 0, right: 0 }, 'iPhone 14 Pro Max Dynamic Island 59'],
  [932, 430, { top: 0, bottom: 21, left: 59, right: 59 }, 'iPhone landscape notch left/right 59'],
  [1024, 768, { top: 24, bottom: 20, left: 0, right: 0 }, 'iPad status bar 24'],
  [1280, 800, { top: 0, bottom: 0, left: 0, right: 0 }, 'desktop, no inset']
];
const problems = [];
const check = (ok, message) => { if (!ok) problems.push(message); };

await withBrowser(async browser => {
  const { evaluate, send, pause, errors } = browser;
  await createCareerInPage(browser, { weeks: 2 });
  await openCareer(browser); await pause(2500);
  const dismiss = () => evaluate(`document.querySelectorAll('[data-news-popup-close],[data-outcome-dismiss],[data-report-close]').forEach(e => e.click()), true`);
  const device = async (w, h, insets) => {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 3, mobile: w < 1100 });
    await send('Emulation.setSafeAreaInsetsOverride', { insets });
    await send('Emulation.setTouchEmulationEnabled', { enabled: w < 1100, maxTouchPoints: 5 }); // a touch screen: pointer: coarse, as on a phone or a tablet
    await pause(450);
  };
  const shot = async name => { if (!SHOTS) return; await mkdir(SHOTS, { recursive: true }); const { data } = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(`${SHOTS}/${name}.png`, Buffer.from(data, 'base64')); };
  const measure = () => evaluate(`(() => {
    const bar = document.querySelector('.topbar'); const r = bar.getBoundingClientRect(); const cs = getComputedStyle(bar); const band = document.querySelector('.top-band'); const br = band ? band.getBoundingClientRect() : null; const bcs = band ? getComputedStyle(band) : null; const bandInfo = band ? { top: Math.round(br.top * 10) / 10, bottom: Math.round(br.bottom * 10) / 10, h: Math.round(br.height * 10) / 10, padTop: parseFloat(bcs.paddingTop), left: br.left, right: br.right, text: band.textContent.trim(), overflow: band.scrollWidth > band.clientWidth + 1, anim: getComputedStyle(band.querySelector('.top-band-dot')).animationName, noFlag: !document.querySelector('.topbar-flag') && !band.querySelector('i:not(.top-band-dot)') } : null;
    const controls = [...bar.querySelectorAll('button')].filter(b => getComputedStyle(b).display !== 'none').map(b => { const q = b.getBoundingClientRect(); return { cls: b.className.split(' ')[0], top: Math.round(q.top * 10) / 10, left: Math.round(q.left * 10) / 10, right: Math.round(q.right * 10) / 10, w: Math.round(q.width * 10) / 10, h: Math.round(q.height * 10) / 10 }; });
    const probe = document.createElement('div'); probe.className = 'report-backdrop'; probe.style.cssText = 'position:fixed;visibility:hidden'; document.querySelector('.app-shell').appendChild(probe);
    const backdropPad = parseFloat(getComputedStyle(probe).paddingTop); probe.remove();
    const flag = document.querySelector('.topbar-flag'); const fr = flag ? flag.getBoundingClientRect() : null; const avatar = document.querySelector('.topbar-brands .topbar-party'); const ar = avatar ? avatar.getBoundingClientRect() : null; const logo = document.querySelector('.topbar-brand'); const lr = logo ? logo.getBoundingClientRect() : null;
    const stripes = flag ? [...flag.querySelectorAll('i')].map(i => getComputedStyle(i).backgroundColor) : [];
    const iconOffsets = [...bar.querySelectorAll('.icon-button')].map(b => { const sv = b.querySelector('svg'); if (!sv) return 0; const q = b.getBoundingClientRect(), r2 = sv.getBoundingClientRect(); return Math.max(Math.abs((r2.left + r2.right) / 2 - (q.left + q.right) / 2), Math.abs((r2.top + r2.bottom) / 2 - (q.top + q.bottom) / 2)); });
    const tabs = document.querySelector('.sx-tabs'); 
    return { band: bandInfo, barTop: Math.round(r.top * 10) / 10, barH: Math.round(r.height), padTop: parseFloat(cs.paddingTop), bodyPadTop: parseFloat(getComputedStyle(document.body).paddingTop), bodyPadLeft: parseFloat(getComputedStyle(document.body).paddingLeft), bodyPadRight: parseFloat(getComputedStyle(document.body).paddingRight), iconOffsets, controls, flag: fr ? { left: fr.left, right: fr.right, top: fr.top, bottom: fr.bottom, w: fr.width, h: fr.height, cy: (fr.top + fr.bottom) / 2, stripes } : null, avatar: ar ? { cy: (ar.top + ar.bottom) / 2, right: ar.right } : null, logo: lr ? { cy: (lr.top + lr.bottom) / 2 } : null, backdropPad, stickyTop: tabs ? parseFloat(getComputedStyle(tabs).top) : null, scale: parseFloat(getComputedStyle(document.querySelector('.app-shell')).zoom) || 1, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
  })()`);
  await dismiss();
  for (const platform of ['ios', 'android']) {
    await evaluate(`document.documentElement.classList.remove('platform-ios', 'platform-android'); document.documentElement.classList.add('platform-${platform}'); true`);
    const touch = platform === 'android' ? 48 : 44;
    for (const scale of [1, 1.3]) {
      await evaluate(`document.documentElement.style.setProperty('--ui-scale', '${scale}'); true`);
      for (const [w, h, insets, label] of CASES) {
        await device(w, h, insets); await evaluate(`location.hash = '#panoramica'; true`); await pause(600); await dismiss();
        const m = await measure();
        const where = `${platform} ×${scale} · ${w}×${h} · ${label}`;
        
        check(m.bodyPadTop === 0, `${where}: nessun padding-top sul body (sarebbe doppio con la barra): ${m.bodyPadTop}.`);
        // the first row of controls sits at inset + the normal padding, once (not doubled, not multiplied by the zoom)
        const first = Math.min(...m.controls.map(c => c.top));
        const expectedMin = insets.top + (m.band ? m.band.h - insets.top : 0);
        check(first >= expectedMin + 6, `${where}: i controlli stanno sotto l'inset (${first} ≥ ${expectedMin} + 6).`);
        const basePad = (w <= 600 ? 11 : w <= 900 ? 12 : 0) * scale;
        if (w <= 900) check(Math.abs(m.padTop * m.scale - basePad) <= 1.5, `${where}: la barra tiene il suo padding originale ${(m.padTop * m.scale).toFixed(1)} ≈ ${basePad.toFixed(1)} (l'inset sta nella fascia).`);
        if (w > 900) check(Math.abs(m.barH - 76 * scale) <= 3, `${where}: altezza barra invariata ${m.barH} ≈ 76×${scale}.`);
        check(m.bodyPadLeft === insets.left && m.bodyPadRight === insets.right, `${where}: i lati rispettano l'inset (${m.bodyPadLeft}/${m.bodyPadRight}).`);
        check(Math.abs(m.backdropPad * m.scale - Math.max(20 * m.scale, insets.top)) <= 1.5, `${where}: finestre e fogli rispettano l'inset in alto (${m.backdropPad}).`);
        if (m.stickyTop !== null) check(Math.abs(m.stickyTop - insets.top) <= 1.5 * scale || Math.abs(m.stickyTop * scale - insets.top) <= 1.5, `${where}: le schede fisse restano sotto l'inset (top ${m.stickyTop}).`);
        // touch targets: Home, Salva, Avanza (the controls of the bar), never smaller than 44 / 48, never overlapping, never off screen
        if (w <= 600 || w <= 1024) {
          for (const c of m.controls) check(c.w >= touch - 0.5 && c.h >= touch - 0.5, `${where}: «${c.cls}» ${c.w}×${c.h} ≥ ${touch}×${touch}.`);
          for (let i = 0; i < m.controls.length; i++) for (let j = i + 1; j < m.controls.length; j++) { const a = m.controls[i], b = m.controls[j]; const apart = a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.top + a.h <= b.top + 0.5 || b.top + b.h <= a.top + 0.5; check(apart, `${where}: i controlli non si sovrappongono (${a.cls}/${b.cls}).`); }
          for (const c of m.controls) check(c.left >= insets.left - 0.5 && c.right <= w - insets.right + 0.5, `${where}: «${c.cls}» dentro l'area sicura laterale.`);
        }
        // the new editorial band above the bar: it carries the safe area, same surface, no tricolore, no overflow
        check(Boolean(m.band) && m.band.top === 0, `${where}: la fascia superiore parte dal bordo (top ${m.band?.top}).`);
        check(m.band && !m.barHasFlag && m.band.noFlag, `${where}: nessuna bandiera/tricolore nella barra né nella fascia.`);
        check(m.band && Math.abs(m.band.padTop * m.scale - insets.top) <= 1.5, `${where}: la fascia assorbe l'inset (${(m.band?.padTop * m.scale).toFixed(1)} reale ≈ ${insets.top}, non moltiplicato dallo zoom).`);
        check(m.band && m.band.h * 1 >= 24 * scale + insets.top - 1 && m.band.h <= 30 * scale + insets.top + 1, `${where}: altezza fascia ${m.band?.h} = inset ${insets.top} + ~26-28×${scale}.`);
        check(m.band && Math.abs(m.barTop - m.band.bottom) <= 0.6, `${where}: la barra segue subito la fascia (${m.barTop} / ${m.band?.bottom}).`);
        check(m.band && !m.band.overflow && m.band.left >= insets.left - 0.5 && m.band.right <= w - insets.right + 0.5 && m.band.text.length > 3, `${where}: testo della fascia senza overflow e in area sicura («${m.band?.text}»).`);
        check(m.iconOffsets.every(o => o <= 1 + (w > 1100 ? 3 : 0)), `${where}: le icone sono al centro dei pulsanti (${m.iconOffsets.map(o => o.toFixed(1))}).`);
        // the buttons Home/Save: same size, icons centred
        const iconButtons = m.controls.filter(c => c.cls === 'icon-button');
        if (iconButtons.length === 2) check(Math.abs(iconButtons[0].w - iconButtons[1].w) < 0.6 && Math.abs(iconButtons[0].h - iconButtons[1].h) < 0.6 && Math.abs(iconButtons[0].top - iconButtons[1].top) < 0.6, `${where}: Home e Salva uguali e allineati.`);
        check(m.sw <= m.cw + 1, `${where}: nessuno scorrimento orizzontale (${m.sw} > ${m.cw}).`);
        if (platform === 'ios' && scale === 1 && ['iPhone 11 notch 48', 'iPhone 14 Pro Max Dynamic Island 59', 'iPhone landscape notch left/right 59', 'Android status bar 24'].includes(label)) await shot(`${platform}-${w}x${h}`);
      }
    }
  }
  // the same bar during the game: the Elezioni page and a secondary page
  await evaluate(`document.documentElement.classList.remove('platform-android'); document.documentElement.classList.add('platform-ios'); document.documentElement.style.setProperty('--ui-scale', '1'); true`);
  await device(430, 932, { top: 59, bottom: 34, left: 0, right: 0 });
  for (const page of ['elezioni', 'sondaggi', 'parlamento', 'impostazioni', 'notizie', 'partito']) {
    await evaluate(`location.hash = '#${page}'; true`); await pause(700); await dismiss();
    const m = await measure();
    check(m.band && m.band.top === 0 && Math.abs(m.padTop - 11) <= 1.5 && m.band.h >= 59 + 24, `gioco · #${page}: stessa fascia + barra della Home (fascia ${m.band?.h}, padding barra ${m.padTop}).`);
    for (const c of m.controls) check(c.top >= 59 + 26 && c.w >= 44 && c.h >= 44, `gioco · #${page}: «${c.cls}» sotto l'inset e ≥ 44 (${c.w}×${c.h} a ${c.top}).`);
  }
  // the language buttons of the start screen: below the real inset with a comfortable margin, equal and aligned, touch size, padding applied ONCE (not on the body too), same in the native app and on the web
  for (const platform of ['ios', 'android', 'web']) {
    for (const [w, h, insets, label] of CASES.filter(([cw]) => cw <= 932)) {
      await evaluate(`document.documentElement.classList.remove('platform-ios', 'platform-android'); ${platform === 'web' ? '' : `document.documentElement.classList.add('platform-${platform}');`} true`);
      await device(w, h, insets);
      await evaluate(`(document.querySelector('.menu-shell') ? 0 : document.querySelector('[data-action=menu]')?.click()), true`); await pause(500);
      const lang = await evaluate(`(() => { const g = document.querySelector('.menu-lang'); if (!g) return null; const bs = [...g.querySelectorAll('button')].map(b => { const r = b.getBoundingClientRect(); return { top: r.top, left: r.left, right: r.right, w: r.width, h: r.height, cy: (r.top + r.bottom) / 2 }; }); const gr = g.getBoundingClientRect(); const shell = document.querySelector('.menu-shell'); return { bs, groupTop: gr.top, groupLeft: gr.left, groupRight: gr.right, bodyPadTop: parseFloat(getComputedStyle(document.body).paddingTop), shellPadTop: parseFloat(getComputedStyle(shell).paddingTop), scale: parseFloat(getComputedStyle(document.querySelector('.app-shell') ?? document.body).zoom) || 1, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; })()`);
      const where = `lingue · ${platform} · ${w}×${h} · ${label}`;
      if (!lang) { check(false, `${where}: i pulsanti delle lingue non si trovano.`); continue; }
      const touch = platform === 'android' ? 48 : 44;
      check(lang.groupTop >= insets.top + 16, `${where}: i pulsanti stanno ${lang.groupTop.toFixed(0)} px dal bordo, sotto l'inset ${insets.top} con almeno 16 px di margine.`);
      check(lang.bodyPadTop === 0, `${where}: nessun padding-top sul body (la safe area è applicata una volta sola).`);
      check(lang.bs.length === 2 && lang.bs.every(b => b.h >= touch - 0.5 && b.w >= touch), `${where}: due pulsanti da tocco ≥ ${touch} (${lang.bs.map(b => `${b.w.toFixed(0)}×${b.h.toFixed(0)}`)}).`);
      check(Math.abs(lang.bs[0].cy - lang.bs[1].cy) < 0.6 && Math.abs(lang.bs[0].h - lang.bs[1].h) < 0.6 && Math.abs(lang.bs[0].w - lang.bs[1].w) < 2, `${where}: i due pulsanti sono uguali e allineati.`);
      check(lang.groupLeft >= insets.left - 0.5 && lang.groupRight <= w - insets.right + 0.5 && lang.sw <= lang.cw + 1, `${where}: dentro l'area sicura laterale, senza overflow.`);
      await shot(`lingue-${platform}-${w}x${h}`.replace(/[^a-z0-9x-]/gi, ''));
      await evaluate(`document.querySelector('[data-menu=continua]')?.click(), true`); await pause(300);
    }
  }
  await evaluate(`document.documentElement.classList.add('platform-ios'); true`);
  await device(430, 932, { top: 59, bottom: 34, left: 0, right: 0 });
  await evaluate(`document.querySelector('[data-action=menu]')?.click(), true`); await pause(500);
  // the start screen (Home with Nuova partita / Continua) keeps clear of the inset too
  await evaluate(`document.querySelector('[data-action=menu]')?.click(), true`); await pause(600);
  const menuTop = await evaluate(`(() => { const shell = document.querySelector('.menu-shell'); if (!shell) return null; const first = shell.querySelector('.main-menu'); return { pad: parseFloat(getComputedStyle(shell).paddingTop), firstTop: Math.round(first.getBoundingClientRect().top) }; })()`);
  if (menuTop) check(menuTop.firstTop >= 59 + 8, `schermata iniziale: il contenuto parte sotto l'inset (${menuTop.firstTop} ≥ 59 + 8).`);
  await shot('ios-430x932-schermata-iniziale');
  check(errors.length === 0, `Nessun errore JavaScript: ${errors.slice(0, 3).join(' | ')}`);
});
if (problems.length) { console.error(`Safe area e barra superiore: ${problems.length} problemi.\n${[...new Set(problems)].slice(0, 40).join('\n')}`); process.exit(1); }
console.log('Safe area e barra superiore (inset emulati): barra dal bordo con sfondo continuo, controlli sotto notch/Dynamic Island/status bar una sola volta anche con zoom 1,3, lati in landscape, finestre e schede rispettano l’inset, aree touch ≥ 44 (iOS) / 48 (Android), nessuna sovrapposizione, Home e gioco uguali.');
