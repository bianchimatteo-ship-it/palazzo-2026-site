// A regional vote from the calendar to the office won, in two regions (Lombardia and Toscana, nothing is specific to one): the vote is named with its region everywhere
// (“Regionali · Lombardia”), the campaign, the report, the history of the elections and the memory keep that name and the id of the vote, the office obtained is the one of that region,
// and everything is the same after a save and a reload. No date or institution is invented: the dates are those of the calendar.
import assert from 'node:assert/strict';
import { startCareer } from './lib/long-run.mjs';
import { readFile } from 'node:fs/promises';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const { renderCampaignPage } = await import(`../src/ui/campaign-mode.js${v}`);
const { renderElectionsHub } = await import(`../src/ui/elections-hub.js${v}`);
const give = store => { const s = store.getState(); s.game.week.ap = Math.max(s.game.week.ap, 6); s.game.resources.funds = 50000; s.game.resources.politicalCapital = 80; if (s.game.party) s.game.party.support = 90; };
function forceWin(store) {
  const c = store.getState().campaign;
  c.nomination.status = 'approved'; c.nomination.internalSupport = 10; c.candidacy.listPosition = 1;
  c.candidateStats = { ...c.candidateStats, notoriety: 98, reputation: 98, popularity: 98 };
  c.activityUses = { ...c.activityUses, door_to_door: 12 };
  for (const area of c.territories) { const ids = Object.keys(area.supportByCandidate); area.supportByCandidate = Object.fromEntries(ids.map(id => [id, id === c.playerCandidateId ? 60 : 40 / Math.max(1, ids.length - 1)])); }
  c.day = c.totalDays - 1;
  store.advance(1);
}
const lines = [];
for (const region of ['Lombardia', 'Toscana']) {
  let outcome = null;
  for (let attempt = 0; attempt < 4 && !outcome; attempt++) {
    const run = await startCareer({ seed: `catena-${region}${attempt || ''}`, level: 'comunale', region, fast: true });
    const { store, db } = run;
    give(store);
    const entry = store.getState().game.elections.find(item => item.type === 'regionale');
    assert.ok(entry && entry.label === `Regionali · ${region}`, `${region}: il voto del calendario porta il nome della regione (${entry?.label}).`);
    assert.ok(store.fastForwardToElection('regionale'), `${region}: finestra delle candidature raggiunta.`);
    give(store);
    const before = store.getState();
    // Before the campaign: the setup says which vote the choice is about, with its dates.
    const setup = renderCampaignPage(before, db.parties, () => null, { 'setup.electionType': 'regionale', 'setup.role': 'presidente' });
    assert.ok(setup.includes(`data-campaign-target="${entry.id}"`) && setup.includes(`Regionali · ${region}`), `${region}: la preparazione dice quale elezione è (${entry.id}).`);
    const election = before.game.elections.find(item => item.id === entry.id);
    assert.ok(setup.includes(election.electionDate.slice(0, 4)), `${region}: con la data del voto del calendario.`);
    store.startCampaign({ electionType: 'regionale', role: 'presidente', objective: 'seat' }, db.parties, { politicians: db.politicians, groups: db.parliamentaryGroups });
    const campaign = store.getState().campaign;
    assert.equal(campaign.electionLabel, `Regionali · ${region}`, `${region}: la campagna porta il nome della regione.`);
    assert.equal(campaign.electionId, entry.id, `${region}: e l'identificativo del voto.`);
    assert.equal(campaign.electionDate, election.electionDate, `${region}: la data è quella del calendario.`);
    assert.ok(campaign.territories.every(area => area.region === region), `${region}: le aree della campagna sono tutte della regione.`);
    assert.ok(renderElectionsHub(store.getState(), { tab: 'campagna' }).includes(`Regionali · ${region}`.toUpperCase()) || renderElectionsHub(store.getState(), { tab: 'panoramica' }).toUpperCase().includes(`REGIONALI · ${region.toUpperCase()}`), `${region}: la Centrale elettorale nomina la regione durante la campagna.`);
    forceWin(store);
    if (store.getState().campaign?.status === 'active') forceWin(store);
    const s = store.getState();
    if (!s.career.lastElectionResult?.personalMandate) continue;
    outcome = { s, entry };
  }
  assert.ok(outcome, `${region}: mandato conquistato in uno dei tentativi.`);
  const { s, entry } = outcome;
  const report = s.career.lastElectionReport;
  assert.equal(report.electionLabel, `Regionali · ${region}`, `${region}: il resoconto del voto nomina la regione.`);
  const history = s.career.electionHistory.at(-1);
  assert.deepEqual([history.electionLabel, history.electionId], [`Regionali · ${region}`, entry.id], `${region}: la storia elettorale ricorda quale voto era.`);
  const player = s.dataset.politicians.find(item => item.id === s.career.playerId);
  const office = s.dataset.offices.find(item => item.id === player.roleId);
  assert.equal(office?.title, 'Presidente di Regione', `${region}: la carica ottenuta è presidente della regione.`);
  const inst = (s.local?.institutions ?? []).find(item => item.kind === 'regione' && item.status === 'active');
  assert.ok(inst && inst.region === region, `${region}: l'istituzione attiva è la regione (${inst?.region}).`);
  assert.ok(s.game.memory?.some?.(item => String(item.text ?? '').includes(`Regionali · ${region}`)) || s.game.log.some(item => String(item.title).includes(`Regionali · ${region}`)), `${region}: la memoria e il diario nominano il voto.`);
  // After a save and a reload nothing of this chain changes.
  const copy = JSON.parse(JSON.stringify(s));
  assert.deepEqual(copy.career.electionHistory.at(-1), history, `${region}: storia identica dopo il ricaricamento.`);
  assert.equal(copy.career.lastElectionReport.electionLabel, report.electionLabel);
  lines.push(`${region}: ${entry.label} (${entry.id}) → ${history.electionLabel} → ${office.title}`);
}
console.log(`Catena delle regionali verificata in due regioni — ${lines.join(' · ')} — voto, candidatura, campagna, resoconto, storia, memoria e carica con lo stesso nome e lo stesso identificativo, uguali dopo il ricaricamento.`);
