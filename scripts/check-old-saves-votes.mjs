// Saves written before the fix of the double count of «Altri» (src/core/result-migration.js): fixtures of a general election and of a European election, aged to the old rule (list votes stretched to all the valid
// ballots), loaded through the real store. A result is repaired only when the old rule is PROVED; the original votes are kept; what cannot be reconstructed with certainty is left exactly as it is.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { approveNomination, startCareer } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const M = await import(new URL(`../src/core/result-migration.js?v=${build}`, import.meta.url).href);
const E = await import(new URL(`../src/core/electorate.js?v=${build}`, import.meta.url).href);
const night = await import(new URL(`../src/core/night-engine.js?v=${build}`, import.meta.url).href);
const clone = value => structuredClone(value);

async function realResult(type, role, seed) {
  const { store } = await startCareer({ seed, level: role === 'eurodeputato' ? 'deputato' : 'deputato', fast: true });
  store.fastForwardToElection(type);
  store.startCampaign({ electionType: type, role: type === 'europee' ? 'eurodeputato' : 'deputato', objective: 'seat' }, []);
  approveNomination(store);
  for (let i = 0; i < 40 && store.getState().campaign?.status === 'active'; i++) store.advance(7);
  // The old saves listed the lists and left «Altri» implicit (valid ballots − lists); a result now also carries the row «altre liste». That row is taken out of the result and of the report of the
  // career (same position), exactly as those saves were written. (Until November 2026 this fixture came from a candidacy the party had turned down, which missed the row; such a campaign now
  // closes with no vote, so the fixture plays a confirmed candidacy.)
  const state = clone(store.getState());
  const at = state.campaign.result.groups.findIndex(g => g.id === 'altre-liste' || g.others);
  if (at >= 0) { state.campaign.result.groups.splice(at, 1); state.career.lastElectionReport.groups.splice(at, 1); }
  store.loadGame(clone(state));
  return { store, state: clone(store.getState()) };
}
// the old rule: the rows shown are stretched to 100 % of the valid ballots
const age = groups => { const valid = groups.valid; return groups; };
function aged(state) {
  const next = clone(state);
  const valid = next.campaign.result.electorate.valid;
  const inflate = rows => { const votes = E.distributeVotes(rows.map(row => row.percent), valid); rows.forEach((row, i) => { row.votes = votes[i]; delete row.votesBefore; delete row.votesMigration; }); };
  inflate(next.campaign.result.groups);
  if (next.campaign.result.firstRound?.groups) { const fr = next.campaign.result.firstRound; const v = E.distributeVotes(fr.groups.map(row => row.percent), fr.electorate?.valid ?? valid); fr.groups.forEach((row, i) => { row.votes = v[i]; }); }
  inflate(next.career.lastElectionReport.groups);
  return next;
}
const sum = rows => rows.reduce((total, row) => total + row.votes, 0);

const lines = [];
for (const [type, seed] of [['politiche', 'old-votes-p'], ['europee', 'old-votes-e']]) {
  const { store, state: current } = await realResult(type, 'deputato', seed);
  const valid = current.campaign.result.electorate.valid;
  const listed = current.campaign.result.groups, shown = listed.reduce((t, g) => t + g.percent, 0);
  assert.ok(shown < 99.95, `${type}: il fixture ha un «Altri» da ricavare (${shown.toFixed(2)} %)`);
  const old = aged(current);
  assert.equal(sum(old.campaign.result.groups), valid, `${type}: il vecchio salvataggio ha le liste gonfiate fino a tutti i voti validi`);
  assert.ok(old.campaign.result.groups.some((g, i) => g.votes !== current.campaign.result.groups[i].votes), `${type}: i voti per lista sono davvero diversi`);
  // ---- through the real store (the path of «Carica partita»)
  store.loadGame(clone(old), 'prova');
  const loaded = store.getState();
  const fixed = loaded.campaign.result.groups;
  assert.deepEqual(fixed.map(g => g.votes), current.campaign.result.groups.map(g => g.votes), `${type}: i voti ricostruiti sono esattamente quelli del motore corretto (certezza)`);
  assert.deepEqual(fixed.map(g => g.votesBefore), old.campaign.result.groups.map(g => g.votes), `${type}: i voti originali restano accanto, non si perdono`);
  assert.ok(fixed.every(g => g.votesMigration === 1), `${type}: ogni riga è marcata come riparata`);
  assert.deepEqual(fixed.map(g => g.percent), old.campaign.result.groups.map(g => g.percent), `${type}: le percentuali originali non cambiano`);
  assert.equal(loaded.campaign.result.electorate.valid, valid, `${type}: il totale dei voti validi non cambia`);
  assert.equal(valid - sum(fixed), current.campaign.result.electorate.valid - sum(current.campaign.result.groups), `${type}: «Altri» = voti validi − liste`);
  assert.ok(sum(fixed) < valid && sum(fixed) + (valid - sum(fixed)) === valid);
  const report = loaded.career.lastElectionReport.groups;
  assert.deepEqual(report.map(g => g.votes), fixed.map(g => g.votes), `${type}: il resoconto storico è allineato al risultato`);
  assert.ok(loaded.saveMeta.votesMigration?.version === 1 && loaded.saveMeta.votesMigration.notes.some(n => n.status === 'riparato'), `${type}: la migrazione è dichiarata nel salvataggio`);
  // ---- run twice: idempotent
  const again = M.migrateElectionVotes(loaded); if (again.changed) console.log('AGAIN', JSON.stringify(again.notes)); assert.equal(again.changed, false, `${type}: una seconda esecuzione non cambia nulla`);
  // ---- the night built from the repaired result: the total of the last hour is the valid ballots
  const snap = night.nightSnapshot(loaded.campaign, 'finale');
  assert.equal(snap.groups.reduce((t, g) => t + g.votes, 0), valid, `${type}: la Notte Elettorale somma ai voti validi (dodicesima ora)`);
  assert.equal(snap.groups.find(g => g.others)?.votes, valid - sum(fixed), `${type}: «Altri» della Notte coincide con quello del risultato`);
  // ---- a night in progress made by the old rule is made again from the same result; a concluded night is history
  const inProgress = clone(loaded); inProgress.night = { id: 'n', key: 'k', stage: 'finale', campaignId: inProgress.campaign.id, concluded: false, hour: 3, snapshot: clone(night.nightSnapshot(old.campaign, 'finale')) };
  // the old night counted «Altri» from the stretched rows: emulate it
  const oldSnap = inProgress.night.snapshot; const oldListed = sum(old.campaign.result.groups); oldSnap.groups = oldSnap.groups.filter(g => !g.others).map((g, i) => ({ ...g, votes: old.campaign.result.groups.find(r => r.id === g.id)?.votes ?? g.votes })); oldSnap.groups.push({ id: 'altri', label: 'Altri', percent: 100 - shown, votes: Math.round(oldListed * 100 / shown) - oldListed, seats: 0, others: true, partyIds: [], isPlayer: false }); oldSnap.totalVotes = oldSnap.groups.reduce((t, g) => t + g.votes, 0);
  const nightFix = M.migrateElectionVotes(inProgress);
  assert.ok(nightFix.changed && nightFix.state.night.snapshotBefore && nightFix.state.night.snapshot.groups.reduce((t, g) => t + g.votes, 0) === valid, `${type}: la Notte in corso viene ricostruita, con l’istantanea precedente conservata`);
  assert.equal(nightFix.state.night.hour, 3, `${type}: l’ora raggiunta non cambia`);
  const done = clone(inProgress); done.night.concluded = true; done.campaign.result.groups = clone(old.campaign.result.groups);
  assert.ok(!M.migrateElectionVotes({ ...done, campaign: { ...done.campaign, result: { ...done.campaign.result, groups: clone(old.campaign.result.groups) } } }).state.night.snapshotBefore, `${type}: una Notte già conclusa non si tocca`);
  // ---- what cannot be proved is left exactly as it is
  const edited = clone(old); edited.campaign.result.groups[0].votes += 1; edited.career.lastElectionReport.groups[0].votes += 1; delete edited.campaign.result.firstRound;
  const editedOut = M.migrateElectionVotes(edited);
  assert.equal(editedOut.changed, false, `${type}: nulla cambia se nessun conteggio è provabile`); assert.deepEqual(editedOut.state.campaign.result.groups, edited.campaign.result.groups, `${type}: voti non riproducibili con la regola precedente: invariati`);
  assert.ok(editedOut.notes.some(n => n.status === 'non-ricostruibile'), `${type}: la limitazione è dichiarata`);
  const noTotal = clone(old); delete noTotal.campaign.result.electorate.valid; delete noTotal.campaign.result.electorate.ballots; delete noTotal.campaign.result.firstRound; delete noTotal.career.lastElectionReport.count.valid; delete noTotal.career.lastElectionReport.count.ballots;
  assert.equal(M.migrateElectionVotes(noTotal).changed, false, `${type}: senza il totale dei voti validi non si ricostruisce nulla`);
  const whole = clone(old); delete whole.campaign.result.firstRound; for (const rows of [whole.career.lastElectionReport.groups]) { const extra = 100 - rows.reduce((t, g) => t + g.percent, 0); rows[0].percent = Math.round((rows[0].percent + extra) * 100) / 100; const v = E.distributeVotes(rows.map(r => r.percent), valid); rows.forEach((r, i) => { r.votes = v[i]; }); }
  { const rows = whole.campaign.result.groups; const extra = 100 - rows.reduce((t, g) => t + g.percent, 0); rows[0].percent = Math.round((rows[0].percent + extra) * 100) / 100; const v = E.distributeVotes(rows.map(r => r.percent), valid); rows.forEach((r, i) => { r.votes = v[i]; }); }
  assert.equal(M.migrateElectionVotes(whole).changed, false, `${type}: se le liste coprono tutto il voto non c’è un «Altri» da ricavare`);
  const local = clone(old); local.campaign.electionType = 'comunale'; local.campaign.result.electionType = 'comunale'; local.career.lastElectionReport.electionType = 'comunale';
  assert.equal(M.migrateElectionVotes(local).changed, false, `${type}: un voto locale non è toccato`);
  // the state that is already right (written by the new engine) is not touched at all
  assert.equal(M.migrateElectionVotes(clone(current)).changed, false, `${type}: un salvataggio nuovo non viene modificato`);
  lines.push(`${type}: ${fixed.length} liste, ${valid} voti validi, «Altri» ${valid - sum(fixed)}`);
}
console.log(`Vecchi salvataggi elettorali: ${lines.join(' · ')} — ricostruzione solo con regola precedente provata, originali conservati, Notte in corso rifatta, il resto invariato.`);
