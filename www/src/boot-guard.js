// Start-up guard (a classic script, loaded before the game): if the game cannot start, the screen says so instead of staying on «Caricamento…» for ever. It watches three things and nothing else:
//  · a script of the game that fails to load (the main module or one of the modules it imports: a dropped request, a stale cache between two builds, the connection gone);
//  · a rejected promise of the loader (a dynamic import that fails) while the game has not started;
//  · a time limit (the game did not start within BOOT_LIMIT_MS: the network is too slow or something hangs).
// On failure it shows a localized message (Italian or English, from the saved language, else the browser's), the technical detail, a «Riprova» button and writes one diagnostic line to the console and to
// localStorage (`politicando.bootDiagnostics`, last five). It never retries by itself except ONE automatic reload per session when the connection comes back; saved games are never touched. The game marks itself as
// started (`window.__politicandoBooted`, set by main.js once the screen is mounted): from then on the guard does nothing.
(function () {
  'use strict';
  var BOOT_LIMIT_MS = 30000;
  var shown = false;
  var failedFiles = [];   // files announced with modulepreload that did not arrive: they name the module that is missing when the main one reports the failure
  var build = '';
  try { build = new URL(document.currentScript.src).searchParams.get('v') || ''; } catch (e) { /* no build stamp */ }
  var TEXT = {
    it: { title: 'Il gioco non è riuscito a caricarsi', body: 'Un file necessario non è stato scaricato: la connessione può essere assente o instabile. Le tue partite salvate non sono state toccate.', slow: 'Il caricamento sta impiegando troppo tempo. Le tue partite salvate non sono state toccate.', retry: 'Riprova', offline: 'Sei senza connessione: riproverò una volta appena torna disponibile.', back: 'Connessione ripristinata: riprovo…', detail: 'Dettaglio tecnico' },
    en: { title: 'The game could not load', body: 'A required file was not downloaded: the connection may be missing or unstable. Your saved games have not been touched.', slow: 'Loading is taking too long. Your saved games have not been touched.', retry: 'Retry', offline: 'You are offline: I will try once more as soon as the connection is back.', back: 'Connection restored: retrying…', detail: 'Technical detail' }
  };
  function language() {
    try { var saved = JSON.parse(localStorage.getItem('politicando.settings.v1') || '{}'); if (saved.language === 'en' || saved.language === 'it') return saved.language; } catch (e) { /* no settings */ }
    return /^it/i.test(navigator.language || '') ? 'it' : 'en';
  }
  function notDone() { return !window.__politicandoBooted && Boolean(document.querySelector('.boot-splash')); }
  function escape(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function remember(entry) {
    try { var list = JSON.parse(localStorage.getItem('politicando.bootDiagnostics') || '[]'); list.push(entry); localStorage.setItem('politicando.bootDiagnostics', JSON.stringify(list.slice(-5))); } catch (e) { /* storage unavailable: the console line is enough */ }
  }
  // the files of the game the browser asked for and did not receive (status 0 in the resource timing): the one that is missing, when the browser reports it
  function missingFiles() {
    try { return performance.getEntriesByType('resource').filter(function (e) { return /\.js(\?|$)/.test(e.name) && e.responseStatus === 0 && e.decodedBodySize === 0 && e.transferSize === 0 && e.duration < 15000; }).map(function (e) { return e.name.replace(location.origin, ''); }).slice(0, 5); } catch (e) { return []; }
  }
  function fail(kind, detail) {
    if (shown || !notDone()) return;
    var lost = failedFiles.concat(missingFiles()).filter(function (name, index, all) { return all.indexOf(name) === index && detail.indexOf(name) < 0; });
    if (lost.length) detail = lost.join(', ') + ' · ' + detail;
    shown = true;
    var entry = { kind: kind, detail: String(detail || ''), build: build, online: navigator.onLine !== false, at: new Date().toISOString(), url: location.pathname };
    try { console.error('[POLITICANDO] avvio non riuscito', entry); } catch (e) { /* no console */ }
    remember(entry);
    var text = TEXT[language()];
    var app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = '<main class="boot-error" role="alert" style="max-width:640px;margin:12vh auto;padding:28px;font:16px/1.6 system-ui,sans-serif;color:#f1eee4;text-align:left">'
      + '<h1 style="font-size:22px;margin:0 0 12px">' + escape(text.title) + '</h1><p>' + escape(kind === 'timeout' ? text.slow : text.body) + '</p>'
      + '<p data-boot-state style="color:#b9c2b4">' + (navigator.onLine === false ? escape(text.offline) : '') + '</p>'
      + '<p><button type="button" data-boot-retry style="font:inherit;font-weight:700;padding:10px 18px;border-radius:10px;border:1px solid #c9a84c;background:#c9a84c;color:#1a1507;cursor:pointer">' + escape(text.retry) + '</button></p>'
      + '<details><summary>' + escape(text.detail) + '</summary><pre style="white-space:pre-wrap;word-break:break-all;color:#b9c2b4">' + escape(kind + ': ' + entry.detail + (build ? ' · build ' + build : '')) + '</pre></details></main>';
    var button = app.querySelector('[data-boot-retry]');
    if (button) button.addEventListener('click', function () { location.reload(); });
    // the connection comes back: ONE automatic reload per session (never a loop)
    window.addEventListener('online', function () {
      var state = app.querySelector('[data-boot-state]');
      var done = false; try { done = sessionStorage.getItem('politicando.bootAutoRetry') === '1'; sessionStorage.setItem('politicando.bootAutoRetry', '1'); } catch (e) { done = false; }
      if (done) return;
      if (state) state.textContent = text.back;
      location.reload();
    });
  }
  // a script of the game that does not load (the error of a resource does not bubble: it is caught in the capture phase)
  window.addEventListener('error', function (event) {
    var target = event.target;
    if (target && target.tagName === 'LINK' && /modulepreload/.test(target.rel || '') && target.href) failedFiles.push(target.href.replace(location.origin, ''));
    if (target && target.tagName === 'SCRIPT' && target.src) fail('script', (failedFiles.length ? failedFiles.slice(0, 5).join(', ') + ' · ' : '') + target.src.replace(location.origin, ''));
  }, true);
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason, message = String(reason && reason.message || reason || '');
    if (notDone() && /import|module|fetch|load|network/i.test(message)) fail('promessa', message);
  });
  setTimeout(function () { fail('timeout', 'avvio non completato entro ' + BOOT_LIMIT_MS / 1000 + ' s'); }, BOOT_LIMIT_MS);
})();
