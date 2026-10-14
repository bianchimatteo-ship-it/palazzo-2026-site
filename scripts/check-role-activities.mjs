// Role activities of the agenda: the Prime Minister (Consiglio dei ministri, cabina di regia sulle opere, tavolo con le parti sociali, conferenza
// stampa, verifica del programma) and the Member of the European Parliament (relazione in commissione, intergruppo, bando europeo, delegazione a
// Bruxelles). Each one is refused without the role (with the reason), costs what it declares, can be done once a week, and leaves a persistent trace
// (a permanent counter, a stat, a government effect, or a consequence weeks later). Also the plan can hold them (one atomic preview/execute).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const parliamentEngine = await import(`../src/core/parliament-engine.js${v}`);
const { WEEKLY_ACTIVITIES } = await import(`../src/data/simulation/career-rules.js${v}`);
const { checkInvariants } = await import(`../src/core/invariants.js${v}`);

const PM = ['consiglio-ministri', 'cabina-regia-opere', 'tavolo-parti-sociali', 'conferenza-stampa-governo', 'verifica-programma'];
const MEP = ['relazione-commissione-ue', 'intergruppo-europeo', 'bando-europeo-territorio', 'delegazione-bruxelles'];
const byId = id => WEEKLY_ACTIVITIES.find(item => item.id === id);
for (const id of [...PM, ...MEP]) {
  const activity = byId(id);
  assert.ok(activity, `${id}: nel catalogo.`);
  assert.equal(activity.weekly, 1, `${id}: una volta a settimana.`);
  assert.ok(activity.requires && activity.requiresLabel, `${id}: requisito e motivo.`);
  assert.ok((activity.risk || activity.later) && activity.effects, `${id}: effetti e rischio o conseguenza.`);
  assert.ok(activity.effects.permanent || activity.later || activity.effects.government || activity.effects.stats || activity.effects.relations, `${id}: lascia qualcosa che resta (indicatori, rapporti, contatore permanente o conseguenza).`);
}

const tryDo = (store, id) => { try { store.performWeeklyActivity(id); return null; } catch (error) { return error.message; } };
const refill = store => { const save = JSON.parse(store.exportSave()); save.game.week.ap = save.game.week.maxAp; save.game.resources.politicalCapital = 90; save.game.resources.funds = Math.max(save.game.resources.funds, 20000); save.game.week.activityUses = {}; store.loadGame(save); };

// ---------- 1. a Member of the European Parliament ----------
{
  const europe = await startCareer({ seed: 'ruoli-europa', level: 'europeo' });
  const { store } = europe;
  store.advance(2);
  refill(store);
  for (const id of PM) {
    const reason = tryDo(store, id);
    assert.ok(reason && /Presidente del Consiglio|governo in carica/i.test(reason), `${id}: rifiutata a un eurodeputato (${reason}).`);
  }
  for (const id of MEP) {
    refill(store);
    const before = JSON.parse(store.exportSave());
    const reason = tryDo(store, id);
    assert.equal(reason, null, `${id}: disponibile per l’eurodeputato (${reason}).`);
    const after = store.getState().game;
    const activity = byId(id);
    assert.equal(before.game.week.ap - after.week.ap, activity.cost.ap ?? 0, `${id}: giorni pagati.`);
    assert.equal((before.game.resources.politicalCapital - after.resources.politicalCapital), activity.cost.capital ?? 0, `${id}: capitale pagato.`);
    assert.equal(tryDo(store, id) !== null, true, `${id}: non si ripete nella stessa settimana.`);
    assert.ok(after.week.activityUses[id] === 1, `${id}: conteggio settimanale.`);
    if (activity.effects.permanent) assert.ok(Object.keys(activity.effects.permanent).every(key => (after.permanentEffects?.[key] ?? 0) >= activity.effects.permanent[key]), `${id}: traccia permanente.`);
  }
  assert.deepEqual(checkInvariants(store.getState(), europe.context).issues, [], 'Invarianti dopo le attività europee.');
  // the next week the weekly limit is back
  store.advance(1);
  refill(store);
  assert.equal(tryDo(store, 'intergruppo-europeo'), null, 'La settimana dopo si può rifare.');
}

// ---------- 2. a Prime Minister ----------
{
  const run = await startCareer({ seed: 'ruoli-premier', level: 'deputato' });
  const { store } = run;
  store.advance(7);
  // a deputy of the majority is refused the Prime Minister's activities
  refill(store);
  for (const id of PM) assert.ok(tryDo(store, id), `${id}: rifiutata a chi non guida il governo.`);
  for (const id of MEP) assert.ok(tryDo(store, id), `${id}: rifiutata a chi non è eurodeputato.`);
  // the same career at the head of the Government
  const save = JSON.parse(store.exportSave());
  const group = save.parliament.player.groupId;
  const allies = save.parliament.government.coalitionGroupIds.filter(id => id !== group);
  let parliament = { ...save.parliament, government: null };
  parliament = parliamentEngine.formGovernment({ ...parliament, resources: { ...parliament.resources, politicalCapital: 90 } }, [group, ...allies], save.clock.currentDate);
  save.parliament = { ...parliament, government: { ...parliament.government, formedBy: 'player', premierGroupId: group } };
  save.game.resources.politicalCapital = 90;
  store.loadGame(save);
  store.advance(7);
  store.voteGovernmentConfidence?.();
  assert.equal(store.getState().parliament.government.primeMinister, 'player', 'Il giocatore guida il governo.');
  for (const id of PM) {
    refill(store);
    const before = JSON.parse(store.exportSave());
    const reason = tryDo(store, id);
    assert.equal(reason, null, `${id}: disponibile al Presidente del Consiglio (${reason}).`);
    const after = store.getState();
    const activity = byId(id);
    assert.equal(before.game.week.ap - after.game.week.ap ?? 0, activity.cost.ap ?? 0, `${id}: giorni pagati.`);
    if (activity.cost.funds) assert.ok(before.game.resources.funds - after.game.resources.funds >= activity.cost.funds - 1, `${id}: fondi pagati.`);
    assert.ok(tryDo(store, id), `${id}: non si ripete nella stessa settimana.`);
    if (activity.effects.permanent) assert.ok(Object.keys(activity.effects.permanent).every(key => (after.game.permanentEffects?.[key] ?? 0) >= 1), `${id}: traccia permanente.`);
    if (activity.effects.government && !activity.risk) assert.ok(after.parliament.government.stability >= before.parliament.government.stability, `${id}: stabilità del governo.`);
  }
  for (const id of MEP) assert.ok(tryDo(store, id), `${id}: rifiutata a chi non è eurodeputato.`);
  // the plan holds them: one preview, one atomic execution, costs charged once
  refill(store);
  const operations = [{ kind: 'activity', id: 'consiglio-ministri' }, { kind: 'activity', id: 'conferenza-stampa-governo' }];
  {
    const preview = store.planPreview(operations);
    assert.ok(preview?.ok, 'Anteprima del piano con attività del premier.');
    const before = JSON.parse(store.exportSave());
    const result = store.executePlan(operations);
    assert.ok(result?.ok !== false, 'Piano eseguito.');
    const after = store.getState().game;
    assert.equal(before.game.week.ap - after.week.ap, 2, 'Due attività da un giorno: due giorni, una volta sola.');
    assert.equal(after.week.activityUses['consiglio-ministri'], 1, 'Nessun doppio addebito.');
  }
  assert.deepEqual(checkInvariants(store.getState(), run.context).issues, [], 'Invarianti dopo le attività del premier.');
}

console.log(`Attività di ruolo verificate: ${PM.length} del Presidente del Consiglio e ${MEP.length} dell’eurodeputato, rifiutate senza il ruolo, a pagamento, una volta a settimana, con tracce permanenti o conseguenze, piano atomico.`);
