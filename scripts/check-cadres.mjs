// Local leaders of the party (Partito › Vita interna), end to end for the comunale, provinciale and regionale levels:
//   - every leader is a simulated PERSON with first and last name and a stable id (the committee keeps its own name; the leader never takes it), flagged as simulated;
//   - a committee without a leader of its own is listed apart with its level and territory; recruiting names a leader (cost paid once), puts him in the right list, updates the committee;
//   - no duplicates (a second recruit on the same committee is refused), nothing on dissolved committees or on the ones the player leads, a replacement is a new person;
//   - names and ids survive a save and a reload, a save from before the names gets them (the same ones every time), and the next weeks do not change them;
//   - in the page: names first, the «Personaggio simulato» badge, filters by level and territory, the recruit button, no horizontal scroll from 320 to 1280 px.
import assert from 'node:assert/strict';

// The long-run harness stands in for the browser (fetch, storage): the page part needs the real fetch back.
const nativeFetch = globalThis.fetch;
import { startCareer } from './lib/long-run.mjs';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

const build = (await (await import('node:fs/promises')).readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const { lifeOverview } = await import(`../src/core/career-engine.js${v}`);
const { cadreName, LOCAL_ROLES } = await import(`../src/core/party-life-engine.js${v}`);
const { checkInvariants } = await import(`../src/core/invariants.js${v}`);

const twoWords = text => /^\S+(\s+\S+)+$/.test(String(text ?? '').trim());
const lifeOf = store => store.getState().game.party.life;
const committeeOf = (store, id) => store.getState().game.party.org.committees.find(item => item.id === id);
const edit = (store, change) => { const save = JSON.parse(store.exportSave()); change(save); store.loadGame(save); };

for (const [level, region] of [['comunale', 'Toscana'], ['provinciale', 'Lombardia'], ['regionale', 'Campania']]) {
  const label = `${level}/${region}`;
  const run = await startCareer({ seed: `cadri-${level}`, level, region, fast: true });
  const { store } = run;
  for (let week = 0; week < 4; week++) store.advance(7);
  let overview = lifeOverview(store.getState().game);
  const named = overview.cadres.filter(item => !item.player);
  assert.ok(named.length >= 3, `${label}: ci sono dirigenti (${named.length}).`);
  assert.equal(new Set(named.map(item => item.personId)).size, named.length, `${label}: id delle persone unici.`);
  assert.equal(new Set(named.map(item => item.personName)).size, named.length, `${label}: nomi e cognomi diversi.`);
  for (const item of named) {
    assert.ok(twoWords(item.personName), `${label}: ${item.personId} ha nome e cognome (${item.personName}).`);
    assert.ok(item.simulated === true && /^persona-quadro-/.test(item.personId), `${label}: persona simulata con id stabile.`);
    assert.notEqual(item.personName, item.name, `${label}: il nome del comitato (${item.name}) non sostituisce quello del dirigente.`);
    assert.ok(item.roleLabel && item.mode, `${label}: ruolo e modalità di gestione.`);
    assert.equal(committeeOf(store, item.committeeId).leader.person?.id, item.personId, `${label}: il comitato conosce il suo responsabile.`);
  }
  const before = new Map(named.map(item => [item.id, [item.personId, item.personName]]));

  // ----- a committee of each local level without a leader: recruit -----
  for (const targetLevel of ['comune', 'provincia', 'regione']) {
    overview = lifeOverview(store.getState().game);
    const committee = overview.committees.find(item => item.level === targetLevel && !item.player && item.cadreId);
    if (!committee) { assert.notEqual(targetLevel, level === 'comunale' ? 'comune' : level === 'provinciale' ? 'provincia' : 'regione', `${label}: il livello del giocatore ha un comitato.`); continue; }
    edit(store, save => {
      const life = save.game.party.life;
      life.cadres = life.cadres.filter(item => item.committeeId !== committee.id);
      const found = save.game.party.org.committees.find(item => item.id === committee.id);
      found.leader = { label: `${LOCAL_ROLES[targetLevel]} (figura simulata)`, currentId: found.leader?.currentId ?? 'territori', player: false };
    });
    overview = lifeOverview(store.getState().game);
    const vacant = overview.committees.find(item => item.id === committee.id);
    assert.ok(vacant.vacant && vacant.leaderName === null && vacant.level === targetLevel, `${label}: ${committee.name} (${targetLevel}) è senza responsabile.`);
    assert.ok(!overview.cadres.some(item => item.committeeId === committee.id), `${label}: nessun dirigente nella lista per ${committee.name}.`);
    // the state of the career before
    const g0 = store.getState().game;
    const funds0 = g0.resources.funds, ap0 = g0.week.ap, count0 = g0.party.org.cadres ?? 0;
    store.partyCadreAction({ action: 'recluta', committeeId: committee.id });
    const g1 = store.getState().game;
    overview = lifeOverview(g1);
    const hired = overview.cadres.find(item => item.committeeId === committee.id);
    assert.ok(hired, `${label}: ${committee.name}: il dirigente compare nella lista.`);
    assert.ok(twoWords(hired.personName) && hired.simulated && hired.level === targetLevel, `${label}: ${committee.name}: nome e cognome, livello ${targetLevel}.`);
    assert.notEqual(hired.personName, committee.name, `${label}: il comitato non dà il nome al dirigente.`);
    assert.equal(hired.mode, 'Scelto da te', `${label}: modalità «scelto da te».`);
    assert.equal(overview.committees.find(item => item.id === committee.id).vacant, false, `${label}: il comitato non è più vacante.`);
    assert.equal(overview.committees.find(item => item.id === committee.id).leaderName, hired.personName, `${label}: il comitato mostra il responsabile.`);
    assert.equal(committeeOf(store, committee.id).leader.person.id, hired.personId, `${label}: il comitato ha il responsabile.`);
    assert.equal(g0.resources.funds - g1.resources.funds, 200, `${label}: 200 € una volta sola.`);
    assert.equal(ap0 - g1.week.ap, 1, `${label}: un giorno.`);
    assert.equal((g1.party.org.cadres ?? 0) - count0, 1, `${label}: il contatore dei quadri sale di uno.`);
    assert.equal(overview.cadres.filter(item => item.committeeId === committee.id).length, 1, `${label}: nessun duplicato.`);
    assert.throws(() => store.partyCadreAction({ action: 'recluta', committeeId: committee.id }), /già un dirigente/, `${label}: un secondo reclutamento è rifiutato.`);
    assert.equal(g1.resources.funds, store.getState().game.resources.funds, `${label}: il rifiuto non addebita nulla.`);
    // a save and a reload keep him; the next weeks too
    const saved = store.exportSave();
    store.loadGame(JSON.parse(saved));
    const again = lifeOverview(store.getState().game).cadres.find(item => item.committeeId === committee.id);
    assert.deepEqual([again.personId, again.personName], [hired.personId, hired.personName], `${label}: ${committee.name}: dopo il ricaricamento è la stessa persona.`);
    for (let week = 0; week < 3; week++) store.advance(7);
    const later = lifeOverview(store.getState().game).cadres.filter(item => item.committeeId === committee.id);
    assert.equal(later.length, 1, `${label}: dopo tre settimane ancora uno.`);
    assert.deepEqual([later[0].personId, later[0].personName], [hired.personId, hired.personName], `${label}: nulla cambia da solo.`);
    // a replacement is another person; the old one is gone from the lists
    store.partyCadreAction({ action: 'sostituisci', cadreId: later[0].id });
    const replaced = lifeOverview(store.getState().game).cadres.find(item => item.committeeId === committee.id);
    assert.notEqual(replaced.personId, hired.personId, `${label}: ${committee.name}: il sostituto è un’altra persona.`);
    assert.ok(twoWords(replaced.personName) && replaced.personName !== hired.personName, `${label}: il sostituto ha un altro nome.`);
    assert.equal(lifeOverview(store.getState().game).cadres.filter(item => item.committeeId === committee.id).length, 1, `${label}: ancora uno solo dopo la sostituzione.`);
  }
  // ----- refusals -----
  const free = lifeOverview(store.getState().game).committees.find(item => !item.player && item.cadreId);
  edit(store, save => { const found = save.game.party.org.committees.find(item => item.id === free.id); const gone = new Set(save.game.party.life.cadres.filter(item => item.committeeId === free.id).map(item => item.id)); save.game.party.life.cadres = save.game.party.life.cadres.filter(item => item.committeeId !== free.id); save.game.party.life.requests = save.game.party.life.requests.filter(item => !(item.from === 'cadre' && gone.has(item.refId))); found.status = 'dissoluzione'; });
  assert.throws(() => store.partyCadreAction({ action: 'recluta', committeeId: free.id }), /comitato attivo/, `${label}: niente incarichi su un comitato sciolto.`);
  assert.ok(!lifeOverview(store.getState().game).committees.some(item => item.id === free.id), `${label}: il comitato sciolto non è più nell’elenco.`);
  assert.throws(() => store.partyCadreAction({ action: 'recluta', committeeId: 'comitato-che-non-esiste' }), /comitato attivo/, `${label}: un comitato che non esiste è rifiutato.`);
  const mine = store.getState().game.party.org.committees.find(item => item.leader?.player);
  if (mine) assert.throws(() => store.partyCadreAction({ action: 'recluta', committeeId: mine.id }), /lo guidi già tu/, `${label}: niente reclutamento dove guidi tu.`);

  // ----- a save from before the names: each leader gets a person, the same one every time -----
  const plain = JSON.parse(store.exportSave());
  for (const cadre of plain.game.party.life.cadres) delete cadre.person;
  for (const committee of plain.game.party.org.committees) if (committee.leader) delete committee.leader.person;
  store.loadGame(JSON.parse(JSON.stringify(plain)));
  const first = lifeOverview(store.getState().game).cadres.filter(item => !item.player).map(item => [item.id, item.personId, item.personName]);
  assert.ok(first.length && first.every(([, id, name]) => id && twoWords(name)), `${label}: un vecchio salvataggio ottiene nomi e cognomi.`);
  store.loadGame(JSON.parse(JSON.stringify(plain)));
  assert.deepEqual(lifeOverview(store.getState().game).cadres.filter(item => !item.player).map(item => [item.id, item.personId, item.personName]), first, `${label}: gli stessi nomi a ogni caricamento.`);
  assert.equal(new Set(first.map(item => item[1])).size, first.length, `${label}: id unici anche dopo la migrazione.`);
  void before;
  const result = checkInvariants(store.getState(), run.context);
  assert.deepEqual(result.issues.filter(item => /dirigent|quadr|cadre/i.test(JSON.stringify(item))), [], `${label}: invarianti dei dirigenti.`);
}
assert.equal(cadreName({ person: { displayName: 'Anna Rossi' }, label: 'x' }), 'Anna Rossi');
assert.equal(cadreName({ label: 'Dirigente locale' }), 'Dirigente locale', 'Senza persona resta l’etichetta di prima.');

// ---------- the page ----------
globalThis.fetch = nativeFetch;
if (!chromeAvailable) console.log('Pagina dei dirigenti saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).');
else await withBrowser(async browser => {
  const { evaluate, viewport, waitFor, pause, version, errors } = browser;
  await createCareerInPage(browser, { party: 'party-futuro-nazionale', level: 'comunale', weeks: 3 });
  await openCareer(browser);
  const open = async tab => evaluate(`(async () => { document.querySelector('[data-nav="partito"]')?.click(); await new Promise(r => setTimeout(r, 500)); document.querySelector('[data-section-tab="partito"][data-section-tab-value="${tab}"]')?.click(); await new Promise(r => setTimeout(r, 700)); return true; })()`);
  await open('territorio');
  await waitFor(() => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); return (store.getState().game.party?.org?.committees ?? []).length > 3; })()`), 40000);
  for (let week = 0; week < 3; week++) await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.advanceTurn(1); return true; })()`);
  await open('vita');
  await waitFor(() => evaluate(`Boolean(document.querySelector('.pl-cadre'))`), 20000);
  const page = await evaluate(`(() => ({ names: [...document.querySelectorAll('.pl-cadre .pl-person-name')].map(el => el.textContent.trim()), badges: [...document.querySelectorAll('.pl-cadre')].filter(el => /Personaggio simulato/.test(el.textContent)).length, cards: document.querySelectorAll('.pl-cadre').length, vacancies: document.querySelectorAll('.pl-vacant').length, levels: [...document.querySelectorAll('.pl-level')].map(el => el.dataset.level), filters: Boolean(document.querySelector('[data-view-filter-select="cadreLevel"]') && document.querySelector('[data-view-filter-text="cadreQuery"]')) }))()`);
  assert.ok(page.cards >= 3 && page.names.filter(name => name !== 'Tu').every(twoWords), `Nomi e cognomi nella pagina: ${page.names.join(', ')}`);
  assert.ok(page.badges >= page.cards - 1, 'Il badge «Personaggio simulato» è su ogni dirigente.');
  assert.ok(page.vacancies > 0 && page.filters, 'Comitati senza responsabile e filtri nella pagina.');
  // filter by level, then by territory
  await evaluate(`(() => { const select = document.querySelector('[data-view-filter-select="cadreLevel"]'); select.value = 'comune'; select.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await pause(600);
  const onlyComuni = await evaluate(`({ levels: [...document.querySelectorAll('.pl-level')].map(el => el.dataset.level), vacant: [...document.querySelectorAll('.pl-vacant small:nth-of-type(1)')].map(el => el.textContent) })`);
  assert.ok(onlyComuni.levels.every(level => level === 'comune') && onlyComuni.vacant.every(text => /comunale/i.test(text)), `Filtro per livello: ${JSON.stringify(onlyComuni)}`);
  await evaluate(`(() => { const select = document.querySelector('[data-view-filter-select="cadreLevel"]'); select.value = ''; select.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await pause(500);
  await evaluate(`(() => { const input = document.querySelector('[data-view-filter-text="cadreQuery"]'); input.value = 'campania'; input.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await pause(600);
  const campania = await evaluate(`[...document.querySelectorAll('.pl-vacant, .pl-cadre')].map(el => el.textContent)`);
  assert.ok(campania.length && campania.every(text => /campania/i.test(text)), 'Il filtro per territorio mostra solo la Campania.');
  await evaluate(`(() => { const input = document.querySelector('[data-view-filter-text="cadreQuery"]'); input.value = ''; input.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await pause(500);
  // recruit from the page
  const targetBefore = await evaluate(`(() => { const row = document.querySelector('.pl-vacant [data-life-cadre="recruita"], .pl-vacant [data-life-cadre="recluta"]'); return row ? { committee: row.dataset.committeeId, name: row.closest('.pl-vacant').querySelector('strong').textContent } : null; })()`);
  assert.ok(targetBefore, 'C’è un comitato da guidare.');
  await evaluate(`document.querySelector('.pl-vacant [data-life-cadre="recluta"]').click(), true`);
  await waitFor(() => evaluate(`Boolean(document.querySelector('.pl-cadre[data-cadre="quadro-${targetBefore.committee}"]'))`), 15000);
  const hired = await evaluate(`(() => { const card = document.querySelector('.pl-cadre[data-cadre="quadro-${targetBefore.committee}"]'); return { name: card.querySelector('.pl-person-name').textContent, committee: card.querySelector('.pl-committee-line').textContent, simulated: /Personaggio simulato/.test(card.textContent), stillVacant: Boolean(document.querySelector('.pl-vacant[data-committee="${targetBefore.committee}"]')) }; })()`);
  assert.ok(twoWords(hired.name) && hired.simulated && !hired.stillVacant && hired.committee.includes(targetBefore.name), `Il responsabile reclutato compare con il suo nome: ${JSON.stringify(hired)}`);
  // reload: the same person
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.save(); return true; })()`);
  await openCareer(browser);
  await open('vita');
  await waitFor(() => evaluate(`Boolean(document.querySelector('.pl-cadre'))`), 20000);
  assert.equal(await evaluate(`document.querySelector('.pl-cadre[data-cadre="quadro-${targetBefore.committee}"] .pl-person-name')?.textContent`), hired.name, 'Dopo il ricaricamento della pagina è la stessa persona.');
  // widths
  for (const [width, height] of [[320, 640], [360, 800], [375, 812], [390, 844], [430, 932], [768, 1024], [1024, 768], [1280, 800]]) {
    await viewport(width, height, width < 800);
    await pause(250);
    const over = await evaluate(`(() => { const vw = document.documentElement.clientWidth; const bad = [...document.querySelectorAll('.pl-page *')].filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.right > vw + 1 || r.left < -1) && !el.closest('.sx-table-wrap'); }).slice(0, 3).map(el => el.tagName + '.' + el.className); return { page: document.documentElement.scrollWidth - vw, bad }; })()`);
    assert.ok(over.page <= 1 && !over.bad.length, `${width}px: nessun overflow (${JSON.stringify(over)})`);
  }
  assert.deepEqual(errors, [], 'Nessun errore in pagina.');
}, {});

console.log('Dirigenti locali verificati: persone simulate con nome e cognome e id stabili a livello regionale, provinciale e comunale, comitati senza responsabile con reclutamento (un solo addebito, nessun duplicato, rifiuti su comitati sciolti o guidati da te), sostituzione, salvataggio, vecchi salvataggi e pagina con filtri a otto larghezze.');
