// The two ways to play (Realistica / Sandbox) and what winning costs, on the real engine.
//   1. office-engine: every requirement that bars a candidacy is lifted in Sandbox and kept in Realistica (all the elections and roles of the game); the single campaign at a time stays; the
//      incompatibilities between offices are never lifted: they are told before (structured, distinct from the requirements) and are exactly what the win applies.
//   2. the mode belongs to the career: saved, exported, imported, restarted; an old save without it is Realistica; a career does not leak into another.
//   3. a sitting deputy who stands for the Region: the notice names the seat before the candidacy; the seat stays through the campaign; a DEFEAT keeps it; a WIN leaves it (Parliament, offices,
//      history, diary, level of the career); compatible offices and the party roles are untouched.
//   4. Sandbox on the real engine: a deputy with no mayor's mandate stands for President of the Province (Realistica refuses), and every kind of vote is played to its result.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const O = await module('src/core/office-engine.js');
const R = await module('src/core/roles.js');
const { checkInvariants } = await module('src/core/invariants.js');
const lines = [];

// ---------- 1. the rules ----------
{
  const sandbox = { mode: 'sandbox' }, real = { mode: 'realistica' };
  assert.equal(O.gameModeOf({}), 'realistica', 'Una carriera senza modalità è Realistica');
  assert.equal(O.gameModeOf({ gameMode: 'sandbox' }), 'sandbox');
  assert.equal(O.gameModeOf({ gameMode: 'altro' }), 'realistica', 'Un valore sconosciuto non apre nulla');
  const elections = [['comunale', ['sindaco', 'consigliere']], ['provinciale', ['presidente', 'consigliere']], ['regionale', ['presidente', 'consigliere']], ['politiche', ['deputato', 'senatore', 'uninominale']], ['europee', ['eurodeputato']]];
  let opened = 0;
  for (const [type, roles] of elections) for (const role of roles) {
    // in Sandbox NO held office, not even the strangest, bars a candidacy
    for (const held of [[], ['ministro'], ['premier', 'segretario'], ['presidente-repubblica'], ['consigliere-comunale']]) {
      assert.equal(O.candidacyBlock({ held, electionType: type, role, facts: sandbox }), null, `Sandbox: ${type}/${role} con ${held.join(',') || 'nessuna carica'} è aperta`);
      opened++;
    }
  }
  assert.equal(opened, 50);
  // Realistica keeps them
  assert.match(O.candidacyBlock({ held: ['consigliere-comunale'], electionType: 'provinciale', role: 'presidente', facts: real }) ?? '', /sindaci?/i, 'Realistica: il Presidente della Provincia è un sindaco');
  assert.match(O.candidacyBlock({ held: [], electionType: 'provinciale', role: 'consigliere', facts: real }) ?? '', /consiglio provinciale/i, 'Realistica: il consiglio provinciale è di secondo livello');
  assert.match(O.candidacyBlock({ held: ['ministro'], electionType: 'regionale', role: 'consigliere', facts: real }) ?? '', /governo/i, 'Realistica: il Governo non corre per un ente territoriale');
  assert.match(O.candidacyBlock({ held: ['presidente-repubblica'], electionType: 'politiche', role: 'deputato', facts: real }) ?? '', /sopra le parti/i);
  // the single campaign at a time is a limit of the game, kept in both modes
  const overlap = { candidacies: [{ id: 'x', label: 'Comunali', electionDate: '2030-05-20', windowOpensAt: '2030-04-01' }], electionDate: '2030-05-10', windowOpensAt: '2030-04-10' };
  for (const facts of [real, sandbox]) assert.match(O.candidacyBlock({ held: [], electionType: 'regionale', role: 'consigliere', facts, ...overlap }) ?? '', /si sovrappongono/, 'Una campagna alla volta');
  // the incompatibilities are not lifted: told (structured) and applied
  const lapses = O.candidacyLapses({ held: ['deputato'], electionType: 'regionale', role: 'consigliere', facts: sandbox });
  assert.deepEqual(lapses.map(item => item.office), ['deputato']);
  assert.match(lapses[0].rule, /art\. 122/i); assert.equal(lapses[0].label, 'Deputato');
  assert.deepEqual(O.candidacyLapses({ held: ['deputato'], electionType: 'regionale', role: 'consigliere', facts: real }).map(item => item.office), ['deputato'], 'Stesso avviso in Realistica');
  const several = O.candidacyLapses({ held: ['deputato', 'assessore-regionale'], electionType: 'europee', role: 'eurodeputato' }).map(item => item.office).sort();
  assert.deepEqual(several, ['assessore-regionale', 'deputato'], 'Incompatibilità multiple: tutte le cariche, una per una');
  assert.deepEqual(O.candidacyLapses({ held: ['consigliere-comunale'], electionType: 'provinciale', role: 'consigliere' }), [], 'Cariche compatibili: nessun avviso');
  assert.deepEqual(O.candidacyLapses({ held: [], electionType: 'regionale', role: 'consigliere' }), [], 'Senza cariche: nessun avviso');
  assert.deepEqual(O.candidacyLapses({ held: ['deputato', 'capogruppo'], electionType: 'regionale', role: 'consigliere' }).map(item => item.office), ['deputato'], 'Le cariche derivate (capogruppo) non si contano due volte');
  // the notice is the list the win applies
  assert.deepEqual(O.lostOffices(['deputato', 'capogruppo'], 'consigliere-regionale').map(item => item.office), ['deputato']);
  lines.push('regole: ' + opened + ' candidature aperte in Sandbox, requisiti tenuti in Realistica, una campagna alla volta, avvisi = perdite applicate');
}

// ---------- 2. the mode belongs to the career ----------
let saveText;
{
  const sand = await startCareer({ seed: 'mode-a', level: 'deputato', fast: true, territorial: true, region: 'Lombardia', draft: { gameMode: 'sandbox' } });
  assert.equal(sand.store.getState().career.gameMode, 'sandbox', 'La modalità è salvata nella carriera');
  assert.equal(R.candidacyFacts(sand.store.getState(), { electionType: 'provinciale' }).mode, 'sandbox');
  sand.store.advance(7);
  saveText = sand.store.exportSave();
  assert.equal(JSON.parse(saveText).career.gameMode, 'sandbox', 'L’esportazione porta la modalità');
  const real = await startCareer({ seed: 'mode-b', level: 'deputato', fast: true, territorial: true, region: 'Lombardia' });
  assert.equal(real.store.getState().career.gameMode, 'realistica', 'Senza scelta è Realistica');
  // import / restart: the mode follows the save, never the previous career
  real.store.loadGame(saveText);
  assert.equal(real.store.getState().career.gameMode, 'sandbox', 'Dopo l’importazione la carriera è Sandbox');
  const old = JSON.parse(saveText); delete old.career.gameMode;
  real.store.loadGame(JSON.stringify(old));
  assert.equal(real.store.getState().career.gameMode, undefined, 'Una vecchia carriera non ha il campo…');
  assert.equal(R.candidacyFacts(real.store.getState(), { electionType: 'provinciale' }).mode, 'realistica', '…ed è Realistica');
  assert.equal(O.gameModeOf(real.store.getState().career), 'realistica');
  assert.ok(checkInvariants(real.store.getState()).ok, 'Invarianti dopo il caricamento');
  lines.push('modalità: salvata, esportata, importata, vecchie carriere Realistiche, nessuna perdita tra carriere');
}

// ---------- 3 & 4. on the real engine ----------
const open = (store, type, days = 35) => {
  // the vote of that kind is brought forward (the calendar of the game puts the Region after the general election: the player's seat is the one he has today)
  const save = JSON.parse(store.exportSave());
  const day = n => new Date(Date.parse(`${save.clock.currentDate}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  save.game.elections = save.game.elections.map(item => item.type === type ? { ...item, id: `${item.id}-anticipata`, status: 'open', windowOpensAt: day(-3), windowClosesAt: day(14), electionDate: day(days) } : item);
  store.loadGame(JSON.stringify(save));
};
const play = async ({ seed, mode, type, role }) => {
  const run = await startCareer({ seed, level: 'deputato', fast: true, territorial: true, region: 'Lombardia', draft: mode ? { gameMode: mode } : {} });
  const { store, db } = run;
  store.advance(7); open(store, type);
  const before = store.getState();
  const info = { run, store, db, before, held: R.heldOfficesOf(before), lapses: O.candidacyLapses({ held: R.heldOfficesOf(before), facts: R.candidacyFacts(before, { electionType: type }), electionType: type, role }) };
  return info;
};
const start = (info, type, role) => info.store.startCampaign({ electionType: type, role, objective: 'seat' }, info.db.parties, { politicians: info.db.politicians, groups: info.db.parliamentaryGroups });
const finish = store => { let guard = 0; while (store.getState().campaign?.status === 'active' && guard++ < 40) store.advance(7); return store.getState(); };

{
  // a DEFEAT keeps the seat
  const lose = await play({ seed: 's1', type: 'regionale', role: 'consigliere' });
  assert.deepEqual(lose.held, ['deputato']);
  assert.deepEqual(lose.lapses.map(item => item.office), ['deputato'], 'Prima della candidatura: avviso sul seggio da deputato');
  start(lose, 'regionale', 'consigliere');
  assert.deepEqual(R.heldOfficesOf(lose.store.getState()), ['deputato'], 'Il seggio resta durante la campagna');
  const after = finish(lose.store);
  assert.equal(after.campaign.result.personalMandate, false, 'Seed s1: il giocatore non è eletto');
  assert.deepEqual(R.heldOfficesOf(after), ['deputato'], 'Sconfitta: il giocatore conserva il seggio');
  assert.ok(after.parliament.player, 'Il Parlamento lo vede ancora');
  assert.ok(!after.dataset.offices.some(o => o.title && /deputato/i.test(o.title) && o.endDate && o.endReason === 'incompatibilità'), 'Nessuna carica chiusa per incompatibilità');
  assert.ok(checkInvariants(after).ok);
  // a WITHDRAWAL keeps it too
  const wd = await play({ seed: 's1', type: 'regionale', role: 'consigliere' });
  start(wd, 'regionale', 'consigliere'); wd.store.clearCampaign();
  assert.deepEqual(R.heldOfficesOf(wd.store.getState()), ['deputato'], 'Ritiro: il seggio resta');
  lines.push('deputato → regionali: avviso prima, seggio mantenuto in campagna, sconfitta e ritiro lo conservano');
}
{
  // a WIN leaves it, everywhere
  const win = await play({ seed: 's8', type: 'regionale', role: 'consigliere' });
  assert.deepEqual(win.lapses.map(item => item.office), ['deputato']);
  start(win, 'regionale', 'consigliere');
  assert.deepEqual(R.heldOfficesOf(win.store.getState()), ['deputato'], 'La carica precedente resta fino alla vittoria');
  const after = finish(win.store);
  assert.equal(after.campaign.result.personalMandate, true, 'Seed s8: il giocatore è eletto');
  assert.deepEqual(R.heldOfficesOf(after), ['consigliere-regionale'], 'Vittoria: il seggio da deputato è perso, resta il nuovo mandato');
  assert.ok(!after.parliament.player, 'Il Parlamento non ha più il giocatore');
  assert.equal(after.career.currentLevel, 'regionale', 'Il livello della carriera segue il nuovo mandato');
  const seat = after.dataset.offices.find(o => /deputato/i.test(o.title ?? '') && o.endDate);
  assert.ok(seat, 'Lo storico degli incarichi ha chiuso il seggio da deputato');
  assert.ok((after.game.log ?? []).some(entry => entry.kind === 'cariche' && /incompatibilità/i.test(entry.title) && entry.lines.some(line => /deputato/i.test(line) && /art\. 122/i.test(line))), 'Il diario dice quale carica è stata lasciata e perché');
  assert.ok(after.career.pastParliamentContexts?.some(item => item.endedAt), 'Il contesto parlamentare è archiviato');
  assert.ok(checkInvariants(after).ok, 'Invarianti dopo la vittoria');
  lines.push('deputato → regionali: vittoria = seggio perso in Parlamento, offices, storico, diario e livello');
}
{
  // Sandbox: the President of the Province without the mandate of mayor, and every kind of vote
  const real = await play({ seed: 's8', mode: 'realistica', type: 'provinciale', role: 'presidente' });
  assert.throws(() => start(real, 'provinciale', 'presidente'), /sindaci/i, 'Realistica: nessuna candidatura alla Presidenza della Provincia senza essere sindaco');
  const sand = await play({ seed: 's8', mode: 'sandbox', type: 'provinciale', role: 'presidente' });
  start(sand, 'provinciale', 'presidente');
  assert.equal(sand.store.getState().campaign.status, 'active', 'Sandbox: la candidatura alla Presidenza della Provincia parte');
  const done = finish(sand.store);
  assert.ok(done.campaign.result && Number.isFinite(done.campaign.result.playerShare), 'Sandbox: scrutinio e risultato per le provinciali');
  assert.ok(checkInvariants(done).ok);
  const kinds = [['comunale', 'sindaco'], ['regionale', 'presidente'], ['europee', 'eurodeputato'], ['politiche', 'senatore']];
  for (const [type, role] of kinds) {
    const run = await play({ seed: 's8', mode: 'sandbox', type, role });
    start(run, type, role);
    const result = finish(run.store);
    assert.ok(result.campaign?.result && Number.isFinite(result.campaign.result.playerShare), `Sandbox: ${type}/${role} giocata fino al risultato`);
    assert.ok(checkInvariants(result).ok, `Invarianti dopo ${type}: ${JSON.stringify(checkInvariants(result).issues?.slice(0, 3))}`);
  }
  lines.push('sandbox: provinciali (Presidenza senza essere sindaco), comunali, regionali, europee e politiche giocate fino al risultato; Realistica rifiuta la Presidenza');
}
console.log(`Modalità di gioco verificate sul motore vero: ${lines.join(' · ')}.`);
