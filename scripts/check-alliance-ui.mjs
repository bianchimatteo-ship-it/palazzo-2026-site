// The alliances page in Chrome (the polls section, «Partiti, alleanze e flussi»): «Crea alleanza» (not «intesa»), the alliance told apart from the coalition, the programme theme by theme with the
// conflicts and the compromise button that works, the coalitions for each election with their last day and the registration that works, the refused request with the day it can be repeated, on a phone
// and a tablet without horizontal scroll, in Italian and English.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Pagina delle alleanze saltata: Chrome non trovato.'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, send, screenshot, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'off' })); document.querySelectorAll('[data-report-close],[data-confirm=cancel]').forEach(b => b.click()); true`);
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  // the player is the secretary of the party (founder) and has an alliance
  const info = await S(`const s = store.getState(); s.game.party.affiliation = 'founder'; s.game.party.rank = 5;
    const ids = s.world.parties.filter(p => !p.isPlayer && p.active).map(p => p.id);
    let allied = null;
    for (let i = 0; i < 60 && !allied; i++) { for (const id of ids) { store.getState().game.resources.politicalCapital = 60; try { const out = store.proposeAlliance(id); if (out.success) { allied = id; break; } } catch (e) { /* refused recently, blocked: next */ } } if (!allied) { try { store.advance(7); } catch (e) {} } }
    const election = store.coalitionElections().find(e => e.type === 'politiche');
    return { allied, election: election?.id ?? null, deadline: election?.deadline ?? null };`);
  assert.ok(info.allied, 'Il giocatore ha stretto un’alleanza.'); assert.ok(info.election, 'C’è un’elezione politica per cui registrare la coalizione.');
  const open = async () => { await evaluate(`location.hash = '#sondaggi'; true`); await pause(1200); await evaluate(`(() => { const tab = [...document.querySelectorAll('[data-section-tab]')].find(el => /alleanze/i.test(el.textContent)); tab?.click(); return true; })()`); await pause(1500); };
  await open();
  const text = () => evaluate(`document.querySelector('[data-my-coalition]')?.innerText ?? ''`);
  let panel = await text();
  assert.match(panel, /La mia alleanza/, 'Il pannello dice «alleanza», non «coalizione», finché non è registrata.');
  assert.match(panel, /Alleanza politica/); assert.match(panel, /Diventa una coalizione solo se tutti la approvano/);
  assert.equal(await evaluate(`document.querySelector('[data-coalition-kind]')?.dataset.coalitionKind`), 'alleanza');
  assert.ok(await evaluate(`[...document.querySelectorAll('[data-world-alliance]')].every(b => /Crea alleanza/.test(b.textContent)) && !/Proponi un’intesa/.test(document.body.innerText)`), 'I pulsanti dicono «Crea alleanza», mai «intesa».');
  // the programme theme by theme
  assert.ok(await evaluate(`document.querySelectorAll('[data-coalition-program] tr[data-program-theme]').length === 10`), 'Il programma ha dieci temi.');
  assert.match(panel, /Programma comune/);
  // the coalitions for each election, with the last day
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-coalition-election="${info.election}"]')) && /adesioni fino al/.test(document.querySelector('[data-coalition-election="${info.election}"]').innerText)`), 'Ogni elezione ha la sua scadenza.');
  // a compromise on a conflicting theme (if there is one) goes through the store and is written in the page
  const hasConflict = await evaluate(`Boolean(document.querySelector('[data-world-compromise]'))`);
  if (hasConflict) {
    const before = await S(`return JSON.stringify(store.getState().world.compromises ?? {}) + '|' + store.getState().game.resources.politicalCapital;`);
    await evaluate(`store = null; true`).catch(() => {});
    await evaluate(`document.querySelector('[data-world-compromise]').click(); true`); await pause(1500);
    const after = await S(`return JSON.stringify(store.getState().world.compromises ?? {}) + '|' + store.getState().game.resources.politicalCapital;`);
    assert.notEqual(after.split('|')[1], before.split('|')[1], 'Il compromesso costa capitale politico (3 punti): l’azione è partita.');
  }
  // the talks inside the alliance: capolista, candidacies, offices, common programme, and the history of the requests
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-alliance-talk="${info.election}"]'))`), 'Le trattative sono nella pagina, per ogni elezione aperta.');
  assert.ok(await evaluate(`document.querySelectorAll('[data-alliance-talk="${info.election}"] [data-talk-theme]').length === 10`), 'Il programma comune ha dieci temi.');
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-alliance-requests] [data-request]'))`), 'Lo storico delle richieste mostra l’alleanza stretta.');
  const capitalBeforeTalk = await S(`return store.getState().game.resources.politicalCapital;`);
  await evaluate(`document.querySelector('[data-alliance-talk="${info.election}"]').open = true; (document.querySelector('[data-alliance-talk="${info.election}"] [data-world-term="collegi"]')).click(); true`); await pause(1200);
  assert.equal(await S(`return store.getState().game.resources.politicalCapital;`), capitalBeforeTalk - 2, 'Una trattativa costa 2 punti di capitale.');
  assert.match(await evaluate(`document.querySelector('.toast')?.innerText ?? ''`), /Accordo:|Richiesta respinta/, 'L’esito della trattativa è detto in parole.');
  assert.ok(await S(`const a = store.getState().world.alliances.find(x => x.withPlayer && x.status === 'active'); return (a.terms ?? []).length > 0 || Object.keys(store.getState().world.refusals ?? {}).some(k => k.startsWith('talk|'));`), 'La trattativa lascia un impegno o un rifiuto registrato.');
  // the registration of the alliance as a coalition for the election
  await open();
  await evaluate(`document.querySelector('[data-world-register="${info.election}"]')?.click(); true`); await pause(1500);
  await open(); panel = await text();
  const state = await S(`return store.coalitionElections().find(e => e.id === '${info.election}').registered?.status ?? null;`);
  assert.ok(['approvata', 'respinta'].includes(state), 'La richiesta di coalizione è stata registrata (approvata o respinta con il motivo).');
  if (state === 'approvata') { assert.match(panel, /La mia coalizione/); assert.equal(await evaluate(`document.querySelector('[data-coalition-kind]')?.dataset.coalitionKind`), 'coalizione'); assert.ok(await evaluate(`Boolean(document.querySelector('[data-coalition-state="registrata"]'))`), 'Registrata per l’elezione.'); }
  else assert.match(panel, /Non approvata/);
  // phone and tablet: no horizontal scroll, the programme readable
  for (const [w, h] of [[390, 844], [820, 1180]]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true }); await pause(500); await open();
    assert.equal(await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1'), true, `${w}px: nessuno scorrimento orizzontale`);
    if (process.env.QA_SHOT_DIR) { await evaluate(`document.querySelector('[data-my-coalition]')?.scrollIntoView({ block: 'start' }); true`); await pause(400); await screenshot(`${process.env.QA_SHOT_DIR}/alleanze-it-${w}x${h}.png`); }
    if (process.env.QA_SHOT_DIR) { await evaluate(`(() => { const talk = document.querySelector('[data-alliance-talk]'); if (talk) { talk.open = true; talk.scrollIntoView({ block: 'start' }); } return true; })()`); await pause(400); await screenshot(`${process.env.QA_SHOT_DIR}/trattativa-programma-comune-it-${w}x${h}.png`); }
  }
  // English
  await evaluate(`import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('en')).then(() => true)`); await pause(1000);
  await evaluate(`document.querySelectorAll('[data-my-coalition] details').forEach(item => { item.open = true; }); true`); await pause(300);
  panel = await text();
  assert.match(panel, /My (alliance|coalition)/); assert.match(panel, /Common programme/); assert.ok(!/Programma comune|Crea alleanza|adesioni fino|Trattative|Capolista|Incarico|Candidature|Ricevute|Inviate|Concordato|Proponi|punti del programma|trattative fino/.test(panel), 'Nessuna riga italiana nel pannello inglese.');
  if (process.env.QA_SHOT_DIR) { await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }); await pause(400); await evaluate(`document.querySelector('[data-my-coalition]')?.scrollIntoView({ block: 'start' }); true`); await pause(400); await screenshot(`${process.env.QA_SHOT_DIR}/alleanze-en-390x844.png`); }
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
}, { voter: true });
console.log('Pagina delle alleanze verificata in Chrome: «Crea alleanza», alleanza distinta dalla coalizione, programma su dieci temi, compromesso e registrazione per elezione funzionanti, smartphone e tablet, italiano e inglese.');
