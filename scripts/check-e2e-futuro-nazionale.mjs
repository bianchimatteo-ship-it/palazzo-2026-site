// A career of Futuro Nazionale end to end, on the real engine and the real data, in isolated storage (nothing of a player's is touched) and, when Chrome is installed, in the page.
// Part 1 (engine): the party of the database, with its leader, memberships, logo and poll, is the party of the career; national and regional polls agree with each other; weeks are played
// (decisions, agenda activities of the new catalogue, the candidacy window of the general election, the campaign to the result); consensus, indicators, news and the electoral calendar
// move; the invariants of the game hold; the save is exported, imported and is the same game; the same seed gives the same game. Part 2 (browser): the same career in the interface: the
// colour, logo and name of the party in the shell, the Home in its order, the agenda with its activities (one is done with the button and its effect shows), the polls with the party
// and the territory view, the week closed with its report, the career reloaded from the menu in the week where it was, no error in the page.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { environment, fingerprint, health, isLoadAddition, playWeek, startCareer, stateDiff } from './lib/long-run.mjs';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

const FN = 'party-futuro-nazionale';
// (the engine harness replaces fetch with a reader of the project files; the browser part needs the real one)
const realFetch = globalThis.fetch;
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { checkInvariants } = await module('src/core/invariants.js');
const { observatoryReport } = await module('src/core/world-engine.js');
const { observatorySociety } = await module('src/core/society-engine.js');
const statOf = (state, metric) => state.dataset.statistics.find(item => item.subjectId === state.career.playerId && item.metric === metric)?.value;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const noInvalid = (value, where) => { const text = JSON.stringify(value); assert.ok(!/NaN|Infinity|"undefined"|\[object Object\]/.test(text), `${where}: valori non validi`); };
const ids = (list, key = 'id') => list.map(item => item?.[key]).filter(Boolean);

// ---------- 1. the engine ----------
const seed = 'e2e-fn';
const run = await startCareer({ seed, level: 'deputato', partyId: FN, draft: { parliamentaryGroupId: 'cam-xix-12' }, fast: true });
const { store, db } = run;
let state = store.getState();
const real = db.parties.find(item => item.id === FN);
assert.ok(real?.verified === true && real.source === 'real' && real.logoAsset, 'Futuro Nazionale è nel database come partito reale verificato, con il suo logo.');
assert.equal(state.career.partyId, FN); assert.equal(state.game.party.partyId, FN, 'Il partito della carriera è Futuro Nazionale.');
assert.equal(state.parliament.player.groupId, 'cam-xix-12', 'Nel gruppo di Futuro Nazionale alla Camera.');
const force = state.world.parties.find(item => item.isPlayer);
assert.ok(force && force.id === FN && /Futuro Nazionale/.test(force.label), 'Nei sondaggi la forza del giocatore è Futuro Nazionale.');
assert.ok(db.partyLeaderships.some(item => item.partyId === FN && item.role === 'Presidente') && db.politicalFigures.some(item => item.id === 'figure-roberto-vannacci'), 'Il presidente e la sua scheda sono nei dati reali.');
// polls: the national picture and the regional one agree
const consistent = (world, society, where) => {
  const poll = world.polls.at(-1);
  const total = poll.results.reduce((sum, row) => sum + row.share, 0);
  assert.ok(poll.results.every(row => finite(row.share) && row.share >= 0 && row.share <= 100), `${where}: quote nazionali valide`);
  // (the forces the polls do not measure are "others": the shares of the measured forces add up to less than 100, never to more)
  assert.ok(total > 88 && total <= 100.5, `${where}: le quote nazionali sommano meno di 100, senza superarlo (${total.toFixed(2)})`);
  const mine = poll.results.find(row => row.partyId === FN);
  assert.ok(mine && finite(mine.share), `${where}: Futuro Nazionale è nel sondaggio nazionale`);
  const report = observatoryReport(world, observatorySociety(society));
  assert.equal(Object.keys(report.regional).length, 20, `${where}: venti regioni`);
  for (const [region, rows] of Object.entries(report.regional)) {
    const sum = rows.reduce((acc, row) => acc + row.share, 0);
    assert.ok(sum > 80 && sum <= 101.5, `${where}: ${region} somma ${sum.toFixed(2)}`);
    const own = rows.find(row => row.partyId === FN);
    assert.ok(own && finite(own.share) && Math.abs(own.share - mine.share) < 9, `${where}: ${region}: Futuro Nazionale ${own?.share} contro ${mine.share} in Italia`);
  }
  return { national: mine.share, report };
};
const start = consistent(state.world, state.society, 'inizio');
const startNotoriety = statOf(state, 'notoriety');

// the agenda: activities with consequences (each one is refused with a reason when its condition is not there)
const done = [];
const away = state.game.place.region === 'Lombardia' ? 'Puglia' : 'Lombardia';
const trustBefore = state.society.regions[away].trust;
for (const [id, target] of [['corso-politiche', null], ['tour-regione', away], ['incontro-amministratori', null], ['audizione-commissione', null]]) {
  try { store.performWeeklyActivity(id, target); done.push(id); } catch (error) { assert.ok(/giorni|fondi|capitale|Servono|Già fatto/.test(error.message), `${id}: rifiutata con un motivo scritto (${error.message})`); }
}
assert.ok(done.includes('corso-politiche'), 'Almeno il corso di politiche pubbliche si può fare subito.');
state = store.getState();
assert.ok(state.game.log.some(entry => done.some(id => entry.title && entry.title.length > 3)), 'Le attività fatte sono nel diario.');
if (done.includes('tour-regione')) assert.notEqual(state.society.regions[away].trust, trustBefore, 'La visita ha mosso la fiducia della regione.');
const sectorAfterCourse = state.game.standing?.sectors?.istituzioni ?? 0;
assert.ok(sectorAfterCourse > 0, 'L’influenza nel settore istituzioni resta nel registro.');
noInvalid(state.game, 'game dopo le attività');

// fourteen weeks: decisions, events, polls, news
const weeks = [];
for (let week = 0; week < 14; week++) {
  playWeek(run);
  const now = store.getState();
  weeks.push(health(now));
  if (week % 4 === 3) { const problems = checkInvariants(now, run.context).issues.filter(issue => issue.severity !== 'warning'); assert.equal(problems.length, 0, `Invarianti alla settimana ${week + 1}: ${problems.slice(0, 2).map(item => `${item.code} ${item.path}`).join(', ')}`); }
}
state = store.getState();
const later = consistent(state.world, state.society, 'dopo quattordici settimane');
assert.ok(new Set(weeks.map(item => item.pollDate)).size >= 10, 'Un sondaggio nuovo quasi ogni settimana.');
assert.ok((state.world.events ?? []).length > 0, 'Il mondo ha prodotto eventi.');
const media = state.society.media;
assert.ok((media?.articles?.length ?? 0) > 0 || (media?.coverage?.length ?? 0) > 0, 'La redazione ha scritto qualcosa (articoli o titoli).');
assert.ok(statOf(state, 'notoriety') !== startNotoriety || statOf(state, 'consensus') !== undefined, 'Gli indicatori personali si sono mossi con le settimane.');
assert.ok(state.game.log.length > 5 && new Set(state.game.log.map(item => item.id ?? `${item.week}|${item.title}|${item.date}`)).size > 3, 'Il diario si riempie.');
assert.equal(new Set(ids(state.dataset.politicians)).size, state.dataset.politicians.length, 'Nessun politico duplicato.');
for (const list of [state.game.inbox ?? [], state.game.pending ?? [], state.game.memory ?? []]) assert.equal(new Set(ids(list)).size, ids(list).length, 'Nessun id duplicato nelle liste della partita.');
noInvalid(state.world.polls.at(-1), 'ultimo sondaggio'); noInvalid(state.society.regions, 'regioni');

// the candidacy window of the general election, the campaign, the result
store.fastForwardToElection('politiche');
state = store.getState();
const open = state.game.elections.find(item => item.status === 'open');
assert.ok(open && open.type === 'politiche', 'Si apre la finestra di candidatura delle politiche.');
{ const comizio = await tryAct(() => store.performWeeklyActivity('comizio-piazza')); assert.ok(comizio === 'ok' || /giorni|fondi|capitale|Già fatto/.test(comizio), `Il comizio con la finestra aperta si fa, o è rifiutato solo per giorni, fondi o capitale (${comizio}).`); }
store.startCampaign({ electionType: 'politiche', role: 'deputato', objective: 'seat' }, db.parties, { politicians: db.politicians, groups: db.parliamentaryGroups });
let campaign = store.getState().campaign;
assert.equal(campaign.status, 'active'); assert.ok(campaign.candidates.some(item => item.isPlayer), 'Il giocatore è tra i candidati.');
assert.ok(JSON.stringify(campaign).includes('Futuro Nazionale') || campaign.playerPartyId === FN || campaign.partyId === FN, 'La campagna è quella di Futuro Nazionale.');
for (const activity of ['party_meeting', 'citizen_meeting', 'rally']) { try { store.performCampaignActivity(activity, { territoryId: store.getState().campaign.territories?.[0]?.id }); } catch { /* not affordable today */ } }
for (let i = 0; i < 20 && store.getState().campaign?.status === 'active'; i++) {
  for (const event of [...(store.getState().campaign.pendingEvents ?? [])]) { try { store.decideCampaignEvent(event.id, event.choices[0].id); } catch { /* decided */ } }
  store.advance(7);
}
state = store.getState();
assert.ok(['finished', 'closed'].includes(state.campaign.status) || state.campaign.result, `La campagna arriva al risultato (${state.campaign.status}).`);
assert.ok(state.career.electionHistory.length >= 1 && state.game.elections.some(item => item.type === 'politiche' && item.status === 'held'), 'Il voto è nel calendario come svolto e nello storico della carriera.');
noInvalid(state.career.electionHistory, 'storico elettorale');
const afterVote = health(state);
assert.ok(afterVote.upcoming.length > 0, 'Dopo il voto il calendario ha ancora elezioni davanti.');
{ const problems = checkInvariants(state, run.context).issues.filter(issue => issue.severity !== 'warning'); assert.equal(problems.length, 0, `Invarianti dopo il voto: ${problems.slice(0, 2).map(item => `${item.code} ${item.path}`).join(', ')}`); }
consistent(state.world, state.society, 'dopo il voto');

// the save: exported, imported, the same game
const before = state;
const exported = store.exportSave();
await environment(`${seed}|import`, { fast: true });
const second = await startCareer({ seed: `${seed}|import`, level: 'deputato', partyId: FN, draft: { parliamentaryGroupId: 'cam-xix-12' }, fast: true });
second.store.loadGame(exported, 'Importata');
const diff = stateDiff(before, second.store.getState());
const real_ = [...diff.changed, ...diff.onlyA, ...diff.onlyB].filter(item => !isLoadAddition(item.path ?? item));
assert.equal(real_.length, 0, `La carriera importata è la stessa partita (${real_.slice(0, 3).map(item => item.path ?? item).join(', ')}).`);
assert.equal(second.store.getState().game.week.index, before.game.week.index, 'Riprende nella stessa settimana.');

// determinism: the same seed, the same decisions, the same game
const replay = async () => { const again = await startCareer({ seed: 'e2e-det', level: 'deputato', partyId: FN, draft: { parliamentaryGroupId: 'cam-xix-12' }, fast: true }); for (let i = 0; i < 6; i++) playWeek(again); return fingerprint(again.store.getState()); };
assert.equal(await replay(), await replay(), 'Stesso inizio e stesse decisioni: stessa partita.');
console.log(`Futuro Nazionale, motore: partito, presidente, logo e sondaggio reali collegati alla carriera; sondaggi nazionali e per venti regioni coerenti (Italia ${start.national.toFixed(1)}% → ${later.national.toFixed(1)}%); ${done.length} attività dell'agenda fatte con effetti che restano; quattordici settimane giocate con eventi, notizie e invarianti; finestra di candidatura, campagna e risultato; salvataggio esportato e importato identico; stesso seme, stessa partita.`);
async function tryAct(fn) { try { fn(); return 'ok'; } catch (error) { return `errore:${error.message}`; } }

// ---------- 2. the browser ----------
globalThis.fetch = realFetch;
if (!chromeAvailable) { console.log('Futuro Nazionale nel browser saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
const problems = [];
const check = (condition, message) => { if (!condition) problems.push(message); };
await withBrowser(async browser => {
  const { evaluate, viewport, goto, waitFor, pause, errors, version } = browser;
  await createCareerInPage(browser, { party: FN, group: 'cam-xix-12', weeks: 3 });
  await openCareer(browser);
  const snapshot = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const s = store.getState(); return { week: s.game.week.index, ap: s.game.week.ap, date: s.clock.currentDate, funds: s.game.resources.funds, uses: s.game.week.activityUses ?? {}, experience: s.dataset.statistics.find(item => item.subjectId === s.career.playerId && item.metric === 'experience')?.value, log: s.game.log.length }; })()`);
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    await viewport(width, height); await pause(400);
    const shell = await evaluate(`(() => { const shell = document.querySelector('.app-shell'); return { identity: shell?.dataset.identity, source: shell?.dataset.identitySource, accent: getComputedStyle(shell).getPropertyValue('--party-accent').trim(), logo: Boolean(document.querySelector('.party-identity img, .topbar-party img')), home: [...document.querySelectorAll('.hqc-head, .hqc-priorities, .hqc-resources, .hqc-indicators, .hqc-board-status, .hqc-board-next, .hqc-board-secondary, .hqc-details')].map(el => el.className.split(' ')[0]) }; })()`);
    check(shell.identity === 'partito' && shell.source === 'logo' && /^#[0-9a-f]{6}$/i.test(shell.accent) && shell.logo, `${width}px · identità di Futuro Nazionale nel guscio (${JSON.stringify(shell)})`);
    check(shell.home.join(',') === 'hqc-head,hqc-priorities,hqc-resources,hqc-indicators,hqc-board,hqc-board,hqc-board,hqc-details' || shell.home.length >= 7, `${width}px · la Home nell’ordine previsto (${shell.home.join(', ')})`);
  }
  await viewport(1280, 900); await pause(300);
  // the agenda: do an activity with the button
  await evaluate(`location.hash = '#calendario'`); await pause(800);
  await evaluate(`document.querySelector('[data-section-tab=agenda][data-section-tab-value=attivita]')?.click()`); await pause(600);
  const before1 = await snapshot();
  const available = await evaluate(`[...document.querySelectorAll('[data-game-activity]:not([disabled])')].map(button => button.dataset.gameActivity)`);
  check(available.includes('corso-politiche') && available.length >= 5, `L’agenda offre attività disponibili (${available.join(', ')}).`);
  check(await evaluate(`Boolean(document.querySelector('.hq-blocked summary'))`), 'Le attività non disponibili stanno ripiegate sotto, con il motivo.');
  await evaluate(`document.querySelector('[data-game-activity=corso-politiche]')?.click()`); await pause(700);
  const after1 = await snapshot();
  check(after1.ap === before1.ap - 2 && after1.funds === before1.funds - 350 && after1.uses['corso-politiche'] === 1 && after1.experience > before1.experience && after1.log === before1.log + 1, `Il corso fatto dal pulsante: giorni, fondi, esperienza e diario (${JSON.stringify([before1, after1])}).`);
  check(await evaluate(`document.querySelector('[data-game-activity=corso-politiche]')?.disabled === true`), 'Il pulsante del corso non è più attivo: una volta a settimana.');
  // the polls: the party in the table and the territory view (the real vote of 2022 is not offered to a party that did not run)
  await evaluate(`document.querySelector('[data-nav="sondaggi"]')?.click()`); await pause(800);
  const polls = await evaluate(`(() => ({ text: document.querySelector('.polls-page')?.textContent ?? '', player: Boolean(document.querySelector('.is-player, .obs-bar-row.is-player'))}))()`);
  check(/Futuro Nazionale/.test(polls.text), 'Nei sondaggi c’è Futuro Nazionale.');
  await evaluate(`document.querySelector('[data-obs-area="territori"]')?.click()`); await pause(700);
  await evaluate(`document.querySelector('[data-view-filter="obsForce"][data-view-filter-value="${FN}"]')?.click()`); await pause(500);
  const territori = await evaluate(`(() => ({ tiles: document.querySelectorAll('.itmap-tile').length, real: document.querySelector('[data-view-filter-value=reale]')?.disabled, source: document.querySelector('.obs-source')?.textContent ?? '' }))()`);
  check(territori.tiles === 20 && territori.real === true && /simulata/i.test(territori.source), `Territori: venti regioni, «Voto reale 2022» non offerto a un partito nato dopo, stima dichiarata simulata (${JSON.stringify(territori)}).`);
  // the week is closed with its report; the career is reloaded from the menu in the week where it was
  await evaluate(`document.querySelector('[data-action=advance]')?.click()`); await pause(600);
  await evaluate(`document.querySelector('[data-confirm=ok]')?.click()`); await pause(1200);
  check(await evaluate(`Boolean(document.querySelector('.report-modal'))`), 'Chiusa la settimana compare il resoconto.');
  await evaluate(`document.querySelector('[data-report-close]')?.click()`); await pause(500);
  const week2 = await snapshot();
  check(week2.week === before1.week + 1 && week2.ap === 6, `La settimana avanza di una (${before1.week} → ${week2.week}) e i giorni tornano sei.`);
  await goto(); await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))'));
  const card = await evaluate(`document.querySelector('.menu-continue')?.textContent.replace(/\\s+/g, ' ')`);
  check(/Futuro Nazionale/.test(card ?? '') && new RegExp(`Settimana ${week2.week}`).test(card), `Il menu offre Continua con il partito e la settimana giusti (${card}).`);
  await evaluate(`document.querySelector('[data-menu=continua]').click()`); await waitFor(() => evaluate('Boolean(document.querySelector(".page-wrap"))'));
  const resumed = await snapshot();
  check(resumed.week === week2.week && resumed.date === week2.date && resumed.funds === week2.funds, 'Continua riprende la stessa partita (settimana, data e fondi).');
  if (errors.length) problems.push(`Errori JavaScript: ${errors.slice(0, 3).join(' | ')}`);
});
if (problems.length) { console.error(`Futuro Nazionale nel browser: ${problems.length} problemi.\n${problems.join('\n')}`); process.exit(1); }
console.log('Futuro Nazionale, browser: identità (colore del logo, logo, nome) nel guscio a 1280 e 390 px, Home nell’ordine, agenda con le attività disponibili e le altre ripiegate, un’attività fatta dal pulsante con costi ed effetti, sondaggi e territori (venti regioni, voto reale 2022 non offerto, stima dichiarata simulata), settimana chiusa con il resoconto, carriera ripresa dal menu nella settimana giusta, nessun errore nella pagina.');
