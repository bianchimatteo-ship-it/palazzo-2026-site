// The page «Referendum» in Chrome, with real clicks: the two referendums told apart, the form (a tax law is refused with the reason), the request by the Regional Councils, the campaign with its
// buttons (side, actions), the result with quorum, the constitutional reform with its three routes, the calendar, phone width without horizontal scroll.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Pagina Referendum saltata: Chrome non trovato.'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, send, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'off' })); document.querySelectorAll('[data-report-close],[data-confirm-cancel]').forEach(item => item.click()); true`);
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const open = async () => { await evaluate(`location.hash = '#panoramica'; true`); await pause(500); await evaluate(`location.hash = '#referendum'; true`); await pause(1500); };
  await S(`const s = store.getState(); s.game.resources.funds = 50000; s.game.resources.politicalCapital = 20; s.parliament = { ...s.parliament, statutes: [{ id: 'st-1', lawId: 'l1', number: 1, title: 'Fondo per le scuole di montagna', summary: 'Un fondo.', area: 'scuola', instrument: 'investimento', kind: 'ddl', origin: 'La maggioranza', approvedAt: s.clock.currentDate, legislature: 1, status: 'vigente', blockable: true, amendments: [] }, { id: 'st-2', lawId: 'l2', number: 2, title: 'Imposta sui consumi', summary: 'Tributaria.', area: 'fisco', instrument: 'tasse', kind: 'ddl', origin: 'La maggioranza', approvedAt: s.clock.currentDate, legislature: 1, status: 'vigente', blockable: true, amendments: [] }] }; return true;`);
  await open();
  let text = await evaluate(`document.querySelector('[data-referendum-page]')?.innerText ?? ''`);
  assert.match(text, /Referendum abrogativo e referendum costituzionale/); assert.match(text, /Quorum/); assert.match(text, /Nessun quorum/); assert.match(text, /art\. 75/); assert.match(text, /art\. 138/, 'I due referendum sono distinti nella pagina.');
  assert.ok(await evaluate(`[...document.querySelectorAll('[data-ref-form] select option')].some(o => o.disabled && /non ammesso/.test(o.textContent))`), 'La legge tributaria è mostrata ma non ammessa.');
  // the form: a partial repeal needs the parts, then the Councils route opens the request
  await evaluate(`(() => { const f = document.querySelector('[data-ref-form]'); f.statuteId.value = 'st-1'; f.scope.value = 'parziale'; f.partText.value = ''; f.route.value = 'consigli'; f.requestSubmit(); return true; })()`); await pause(800);
  assert.match(await evaluate(`document.querySelector('.toast')?.innerText ?? ''`), /quali parti/, 'Senza le parti la parziale è rifiutata con il motivo.');
  await evaluate(`(() => { const f = document.querySelector('[data-ref-form]'); f.statuteId.value = 'st-1'; f.scope.value = 'totale'; f.route.value = 'consigli'; f.requestSubmit(); return true; })()`); await pause(1200);
  assert.equal(await S(`return store.referendums().length;`), 1, 'La richiesta è aperta.');
  text = await evaluate(`document.querySelector('[data-referendum-card]')?.innerText ?? ''`);
  assert.match(text, /Volete voi che sia abrogata/); assert.match(text, /Consigli regionali/);
  // five Councils through the form of the page
  await evaluate(`[...document.querySelectorAll('[data-ref-councils-form] input[name=region]')].slice(0, 12).forEach(i => { i.checked = true; }); document.querySelector('[data-ref-councils-form]').requestSubmit(); true`); await pause(900);
  const phase = await S(`return store.referendums()[0].phase;`);
  assert.ok(['consigli', 'cassazione'].includes(phase), `i Consigli rispondono (fase: ${phase})`);
  // the campaign
  await S(`const s = store.getState(); const r = s.game.referendums[0]; Object.assign(r, { phase: 'campagna', voteDate: '2099-06-06', campaign: { support: 55, turnout: 41, stances: { si: ['a'], no: ['b'], free: [] }, actions: {}, events: [], polls: [{ week: 1, date: s.clock.currentDate, yes: 56, turnout: 42 }], effortWeek: -1, used: 0 } }); return true;`);
  await open();
  assert.ok(await evaluate(`/quorum: più del 50%/.test(document.querySelector('[data-ref-poll]')?.innerText ?? '')`), 'Il sondaggio mostra il quorum.');
  assert.equal(await evaluate(`document.querySelector('[data-ref-actions]') === null`), true, 'Senza una parte scelta non ci sono azioni di campagna.');
  await evaluate(`document.querySelector('[data-ref-choice=si]').click(); true`); await pause(500);
  await evaluate(`document.querySelector('[data-confirm-accept],[data-confirm-ok],.confirm-dialog .primary-button')?.click(); true`); await pause(800);
  assert.equal(await S(`return store.referendums()[0].side;`), 'si', 'La parte è scelta dopo la conferma.');
  await open();
  assert.ok(await evaluate(`document.querySelectorAll('[data-ref-actions] [data-ref-act]').length >= 4`), 'Compaiono le azioni di campagna.');
  const before = await S(`return store.referendums()[0].campaign.support;`);
  await evaluate(`document.querySelector('[data-ref-action=spot]').click(); true`); await pause(900);
  assert.notEqual(await S(`return store.referendums()[0].campaign.support;`), before, 'Lo spot sposta il consenso.');
  assert.equal(await evaluate(`document.querySelector('[data-ref-action=astensione]') === null`), true, 'Chi è per il SÌ non può invitare a non votare.');
  // result
  await S(`const r = store.getState().game.referendums[0]; Object.assign(r, { status: 'concluso', phase: 'concluso', carried: false, outcome: 'Quorum non raggiunto: ha votato il 31,2% degli aventi diritto (serviva più del 50%). Il referendum non è valido e la legge resta in vigore.', result: { electorate: 51000000, voters: 15912000, turnout: 31.2, quorumReached: false, valid: 15673000, blank: 239000, yesVotes: 11000000, noVotes: 4673000, yes: 70.2, no: 29.8, carried: false, simulated: true } }); return true;`);
  await open();
  text = await evaluate(`document.querySelector('[data-ref-result]')?.innerText ?? ''`);
  assert.match(text, /Quorum non raggiunto/); assert.match(text, /non raggiunto/); assert.match(text, /simulati/);
  // constitutional reform: the three routes
  await S(`const s = store.getState(); s.game.referendums = [{ id: 'riforma-ui', kind: 'costituzionale', title: 'Riforma del bicameralismo', status: 'in-corso', phase: 'richiesta', createdAt: s.clock.currentDate, requestUntil: '2099-01-01', side: null, deliberations: [{ which: 1, date: s.clock.currentDate, camera: { share: 58, absolute: true, twoThirds: false }, senato: { share: 57, absolute: true, twoThirds: false } }], councils: { required: 5, approved: [], refused: [] }, request: null, opposition: { camera: 42, senato: 43 }, steps: [] }, ...s.game.referendums]; return true;`);
  await open();
  text = await evaluate(`document.querySelector('[data-referendum-kind=costituzionale]')?.innerText ?? ''`);
  assert.match(text, /un quinto dei membri/); assert.match(text, /500\.000 firme/); assert.match(text, /cinque Consigli regionali/); assert.match(text, /Non c’è quorum/);
  await evaluate(`document.querySelector('[data-ref-route=quinto]').click(); true`); await pause(900);
  assert.equal(await S(`return store.referendums().find(r => r.id === 'riforma-ui').request?.by;`), 'quinto');
  // phone width
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
  await open();
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 1`), true, 'Nessuno scorrimento orizzontale a 360 px.');
  assert.deepEqual(errors.filter(item => !/favicon/.test(String(item))), [], 'Nessun errore JavaScript.');
  console.log('check-referendum-ui: ok');
});
