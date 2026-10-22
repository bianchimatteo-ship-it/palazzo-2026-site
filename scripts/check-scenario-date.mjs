// The day a new career starts: Monday 26 October 2026 (the scenario date of the real data, src/data/real/manifest.json), apart from the day the real data was verified (the snapshot).
// Data: both manifests say the scenario date, it is a Monday and not before the snapshot; the real opening poll is the newest published on or before it (nothing published after it is used);
// the Parliament and the Government in office at the start are the verified ones. Game, in Chrome: the career, the clock, the first week and the wizard all say 26 October; a career
// already saved keeps its date, its week and its history when another career is started and when it is loaded again. Skipped without Chrome (the data part always runs).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';

const read = async name => JSON.parse(await readFile(new URL(`../src/data/real/${name}`, import.meta.url), 'utf8'));
const manifest = await read('manifest.json');
const aggregate = await read('database.json');
const SCENARIO = '2026-10-26';
assert.equal(manifest.scenarioDate, SCENARIO, 'Il manifesto indica la data di inizio delle nuove carriere.');
assert.equal(aggregate.manifest.scenarioDate, SCENARIO, 'Anche l’aggregato.');
assert.equal(new Date(`${SCENARIO}T00:00:00Z`).getUTCDay(), 1, 'È un lunedì: le settimane di gioco cominciano di lunedì.');
assert.ok(manifest.snapshotDate <= SCENARIO && /^\d{4}-\d{2}-\d{2}$/.test(manifest.snapshotDate), 'Lo snapshot dei dati reali non è successivo alla data dello scenario.');
assert.ok(/data dello snapshot/.test(manifest.scenarioNote ?? ''), 'La differenza tra data dello scenario e data di verifica è dichiarata.');
const polls = await read('polls.json');
assert.ok(polls.length > 0 && polls.every(poll => poll.source === 'real' && poll.publishedAt <= SCENARIO && /^https?:\/\//.test(poll.sourceUrl) && (poll.verified === true ? Boolean(poll.verifiedAt) : poll.verificationStatus === 'in-attesa-di-conferma')), 'Ogni sondaggio reale ha una fonte ed è pubblicato entro la data dello scenario; è «verificato» solo con la data di verifica, altrimenti dichiara «in attesa di conferma» (mai verificato a parole).');
const newest = [...polls].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
assert.ok(/startDate: realDatabase\.manifest\?\.scenarioDate \?\? realDatabase\.manifest\?\.snapshotDate/.test(main), 'Il gioco parte dalla data dello scenario (e, se manca, da quella dello snapshot).');
const politicians = await read('politicians.json');
const inOffice = politicians.filter(item => !item.termEnd || item.termEnd > SCENARIO);
assert.ok(inOffice.length === manifest.politiciansInOffice, `I parlamentari in carica al ${SCENARIO} sono quelli del manifesto (${inOffice.length} / ${manifest.politiciansInOffice}).`);
// every mandate has a real calendar date for its start, which is not after the scenario date, and an end (when there is one) that follows the start; whoever ended on or before the scenario date is not in office
const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
assert.ok(politicians.every(item => isDate(item.termStart) && item.termStart <= SCENARIO), 'Ogni mandato ha una data di inizio valida e non successiva alla data dello scenario.');
assert.ok(politicians.every(item => !item.termEnd || (isDate(item.termEnd) && item.termEnd >= item.termStart)), 'La fine di un mandato è una data valida e non precede l’inizio.');
const ended = politicians.filter(item => item.termEnd && item.termEnd <= SCENARIO);
assert.ok(ended.every(item => !inOffice.includes(item)), 'Chi ha il mandato concluso entro la data dello scenario non è tra i parlamentari in carica.');
assert.equal(ended.length + inOffice.length, politicians.length, 'Ogni parlamentare del dataset è in carica o ha concluso il mandato: nessuno è in uno stato indefinito.');
assert.ok(ended.every(item => item.validTo === item.termEnd), 'La data di fine validità del dato coincide con la fine del mandato.');

if (!chromeAvailable) console.log('Parte nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).');
else await withBrowser(async browser => {
  const { evaluate, waitFor, goto, pause, version, errors } = browser;
  const state = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const s = store.getState(); return { startDate: store.startDate(), date: s.clock.currentDate, started: s.career.startedAt, week: s.game?.week, id: s.career.id, poll: s.world?.polls?.[0] ? { source: s.world.polls[0].source, publishedAt: s.world.polls[0].real?.publishedAt, label: s.world.polls[0].real?.label } : null, government: s.parliament?.government ? { name: s.parliament.government.name, status: s.parliament.government.status, primeMinister: s.parliament.government.primeMinister, ministers: s.parliament.government.ministers?.length ?? 0 } : null, history: (s.career.parliamentHistory ?? []).length, events: s.dataset.events.length }; })()`);
  await waitFor(async () => (await state()).startDate === SCENARIO);
  await createCareerInPage(browser, { party: 'party-futuro-nazionale', group: 'cam-xix-12' });
  const first = await state();
  assert.equal(first.date, SCENARIO, 'La nuova carriera parte il 26 ottobre 2026.');
  assert.equal(first.started, SCENARIO); assert.equal(first.week.startedAt, SCENARIO); assert.equal(first.week.index, 1);
  assert.equal(first.poll.source, 'real', 'Il primo sondaggio della carriera è reale.');
  assert.equal(first.poll.publishedAt, newest.publishedAt, 'È il più recente pubblicato entro la data dello scenario.');
  assert.ok(first.poll.publishedAt <= first.date);
  assert.ok(first.government && first.government.status && first.government.ministers > 0, 'Il Governo in carica all’avvio c’è, con i suoi ministri.');
  // regional polls are simulated, the real national poll is not
  const regions = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const poll = store.getState().world.polls[0]; return { regionalSource: poll.regional ? [...new Set(Object.values(poll.regional).flatMap(value => (value && typeof value === 'object' ? [value.source] : [])))] : null, national: poll.source }; })()`);
  assert.equal(regions.national, 'real');
  assert.ok(!regions.regionalSource || regions.regionalSource.every(value => value === undefined || value === 'simulation'), `Le quote regionali restano simulate (${regions.regionalSource}).`);
  // the wizard says the same day: no birth date after it
  await goto();
  await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu=nuova]:not([disabled])"))'));
  await evaluate('document.querySelector("[data-menu=nuova]:not([disabled])").click(), true');
  await waitFor(() => evaluate('Boolean(document.querySelector(".career-wizard"))'));
  const max = await waitFor(() => evaluate('document.querySelector("input[name=birthDate]")?.max || ""'));
  assert.equal(max, SCENARIO, `La procedura di creazione non accetta una nascita dopo il ${SCENARIO} (${max}).`);
  // a career already made keeps its date, week and history
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); for (let i = 0; i < 3; i++) store.advanceTurn(1); store.saveToSlot(); return true; })()`);
  const old = await state();
  assert.ok(old.week.index === 4 && old.date > SCENARIO && old.started === SCENARIO, `Dopo tre settimane: settimana ${old.week.index}, ${old.date}.`);
  await createCareerInPage(browser, { party: 'party-registro-p1-2017-41-ir', group: 'cam-xix-03', name: ['Altra', 'Carriera'], onboarding: false });
  const other = await state();
  assert.equal(other.date, SCENARIO); assert.equal(other.week.index, 1); assert.notEqual(other.id, old.id);
  const loaded = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const slot = store.listSlots().find(item => /partita precedente/i.test(item.name)) ?? store.listSlots()[0]; store.loadSlot(slot.id); const s = store.getState(); return { date: s.clock.currentDate, started: s.career.startedAt, week: s.game.week.index, id: s.career.id, history: (s.career.parliamentHistory ?? []).length, events: s.dataset.events.length }; })()`);
  assert.deepEqual({ date: loaded.date, started: loaded.started, week: loaded.week, id: loaded.id, history: loaded.history, events: loaded.events }, { date: old.date, started: old.started, week: old.week.index, id: old.id, history: old.history, events: old.events }, 'La carriera salvata conserva data, settimana e storia.');
  assert.deepEqual(errors, [], `Errori JavaScript: ${errors.slice(0, 2).join(' | ')}`);
});
console.log(`Data di inizio verificata: ogni nuova carriera parte lunedì ${SCENARIO} (lo snapshot dei dati reali è del ${manifest.snapshotDate}, dichiarato a parte); il sondaggio d’avvio è reale (verificato o dichiarato in attesa di conferma, come dice il file) e pubblicato il ${newest.publishedAt}, nessuna fonte dopo la data dello scenario; ${inOffice.length} parlamentari in carica; Governo e Parlamento di partenza presenti; le quote regionali restano simulate; una carriera già salvata conserva data, settimana e storia.`);
