// Activities with the allies: cost, duration, odds that depend on the allies, success / half-success / failure with their own effects, applied once on the cohesion of the alliance and the relations with
// the partners; only with an alliance, only for the secretary; at most two at a time.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer, playWeek } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const A = await import(new URL(`../src/core/alliance-activities.js?v=${build}`, import.meta.url).href);

// ---------- engine ----------
assert.equal(Object.keys(A.ALLY_ACTIVITIES).length, 5);
const good = A.oddsOf('riunione', { cohesion: 90, relation: 60, compatibility: 0.8 }), bad = A.oddsOf('riunione', { cohesion: 20, relation: -60, compatibility: 0.2 });
assert.ok(good.chance > bad.chance + 0.3, 'coesione e rapporti alti rendono l’attività più probabile');
assert.ok(A.oddsOf('tavolo', { cohesion: 60, relation: 0, compatibility: 0.9 }).chance > A.oddsOf('tavolo', { cohesion: 60, relation: 0, compatibility: 0.1 }).chance, 'il tavolo sul programma dipende dalla compatibilità');
assert.equal(A.oddsOf('riunione', { cohesion: 60, relation: 0, compatibility: 0.1 }).chance, A.oddsOf('riunione', { cohesion: 60, relation: 0, compatibility: 0.9 }).chance, 'la riunione non dipende dai programmi');
assert.throws(() => A.startActivity([], { kindId: 'riunione', allianceId: 'a1', date: '2027-01-10', week: 1 }), /con quale alleato/);
assert.throws(() => A.startActivity([], { kindId: 'riunione', allianceId: null, partnerId: 'x', date: '2027-01-10', week: 1 }), /alleanza/);
let list = [];
for (const kind of ['conferenza', 'territorio']) list = [A.startActivity(list, { kindId: kind, allianceId: 'a1', date: '2027-01-10', week: 1 }), ...list];
assert.throws(() => A.startActivity(list, { kindId: 'mobilitazione', allianceId: 'a1', date: '2027-01-10', week: 1 }), /due attività/);
assert.throws(() => A.startActivity([list.find(item => item.kind === 'conferenza')], { kindId: 'conferenza', allianceId: 'a1', date: '2027-01-10', week: 1 }), /già in corso/);
// not before the end; then success / half / failure, each with its own effects
const run = list.find(item => item.kind === 'conferenza');
assert.equal(A.resolveActivity(run, { week: run.endsWeek - 1, date: '2027-02-01', cohesion: 60, relation: 0, compatibility: 0.5 }), null, 'prima della fine non si risolve');
const seen = new Set();
for (let i = 0; i < 200; i++) {
  const item = { ...run, id: `a-${i}`, endsWeek: 5 };
  const out = A.resolveActivity(item, { week: 5, date: '2027-02-01', cohesion: 60, relation: 0, compatibility: 0.5 });
  seen.add(out.activity.status);
  if (out.activity.status === 'fallita') assert.ok(out.effects.cohesion < 0 && out.tone === 'bad', 'se fallisce la coesione scende');
  if (out.activity.status === 'riuscita') assert.ok(out.effects.cohesion > 0 && out.tone === 'good', 'se riesce la coesione sale');
  if (out.activity.status === 'parziale') assert.ok(out.effects.cohesion > 0 && out.effects.cohesion < A.ALLY_ACTIVITIES.conferenza.win.cohesion, 'a metà: effetto proporzionato, non pieno');
  assert.equal(A.resolveActivity(item, { week: 5, date: '2027-02-01', cohesion: 60, relation: 0, compatibility: 0.5 }).activity.status, out.activity.status, 'deterministico');
}
assert.deepEqual([...seen].sort(), ['fallita', 'parziale', 'riuscita'], 'tutti e tre gli esiti sono possibili');

// ---------- in the game ----------
const { store, db, decide } = await startCareer({ seed: 'attivita-alleati', level: 'deputato', fast: true });
const own = store.getState().game.party;
assert.throws(() => store.startAllyActivity('riunione', 'x'), /segretario/, 'solo il segretario può farlo');
store.getState().game.party = { ...own, affiliation: 'founder' };
assert.throws(() => store.startAllyActivity('riunione', 'x'), /alleanza|alleat/i, 'senza alleanza non si può');
const world = store.getState().world;
const player = world.parties.find(item => item.isPlayer);
const partner = world.parties.find(item => !item.isPlayer && item.active && Number.isFinite(item.axis));
const third = world.parties.find(item => !item.isPlayer && item.active && item.id !== partner.id && Number.isFinite(item.axis));
world.alliances.push({ id: 'alleanza-prova', label: 'Alleanza di prova', kind: 'alleanza', coalitions: [], partyIds: [player.id, partner.id, third.id], leaderId: player.id, cohesion: 60, status: 'active', terms: [], history: [] });
store.getState().game.resources = { ...store.getState().game.resources, funds: 20000, politicalCapital: 20 };
const before = { cohesion: 60, relation: world.parties.find(item => item.id === partner.id).playerRelation, funds: store.getState().game.resources.funds };
assert.ok(store.allyActivityOdds('riunione', partner.id).chance > 0.1, 'le probabilità sono visibili prima di decidere');
assert.throws(() => store.startAllyActivity('riunione', 'non-alleato'), /non è nel tuo accordo/);
const item = store.startAllyActivity('mobilitazione');
assert.equal(store.getState().game.resources.funds, before.funds - 1500, 'la mobilitazione costa 1.500 €');
assert.equal(item.endsWeek - item.startWeek, 4, 'dura quattro settimane');
store.startAllyActivity('riunione', partner.id);
assert.throws(() => store.startAllyActivity('conferenza'), /due attività/, 'al massimo due insieme');
for (let week = 0; week < 6; week++) playWeek({ store, db, decide });
const done = store.allyActivities().filter(entry => entry.allianceId === 'alleanza-prova');
assert.equal(done.length, 2); assert.ok(done.every(entry => entry.status !== 'in-corso'), 'dopo la durata sono concluse');
const alliance = store.getState().world.alliances.find(entry => entry.id === 'alleanza-prova');
assert.ok(alliance.history.length >= 2, 'la cronologia dell’alleanza le racconta');
const diary = store.getState().game.log.filter(entry => /Mobilitazione comune|Riunione dei leader/.test(entry.title));
assert.equal(diary.length, 2, 'il diario le racconta una volta sola ciascuna');
const total = done.reduce((sum, entry) => sum + (entry.effects?.cohesion ?? 0), 0);
assert.ok(alliance.cohesion !== 60 || total === 0, 'la coesione riflette gli esiti (somma effetti ' + total + ')');
console.log('check-ally-activities: ok');
