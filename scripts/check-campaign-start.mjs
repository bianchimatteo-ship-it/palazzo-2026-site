// The consensus a campaign opens with, on the real engine and several deterministic seeds, for every kind of vote, strong and weak parties, newcomers and known names:
//   - it follows the weight of the party where the vote is about parties (a force of 0,3% in the polls does not start where one of 25% does) and the quality of the candidate where it is about people;
//   - a general or European vote starts from the weight of the party in the polls (the anchor) and is not lifted again by the same weight (the bonus of the polls kept only what the allies add);
//   - nothing is counted twice: the bonuses the campaign starts with are listed by part (preparation.pollParts), a race held elsewhere counts the committees in the rooting and not again in the bonus;
//   - the figure on the opening screen is the real one (summary, expectation, history and the weighted share are the same number) and it does not jump after one day without any action;
//   - a low consensus stays possible (a newcomer of a weak party starts low) and a high one too (a known name of a strong party starts well ahead), and the same seed gives the same opening.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { partyPulls, PARTY_PULL, campaignSummary } = await module('src/core/campaign-engine.js');
const lines = [];

// ---------- 1. the pull of the party (pure) ----------
{
  const cand = (id, partyId) => ({ id, partyId });
  const field = [cand('a', 'forte'), cand('b', 'medio'), cand('c', 'debole'), cand('d', null)];
  const weights = { forte: 26, medio: 12, debole: 0.3 };
  for (const type of ['comunale', 'provinciale', 'regionale']) {
    const pulls = partyPulls(field, weights, type);
    assert.ok(pulls.a > pulls.b && pulls.b > pulls.c, `${type}: più peso nei sondaggi, più spinta al candidato.`);
    assert.equal(pulls.d, 1, `${type}: chi non ha un partito non riceve né toglie spinta.`);
    assert.ok(pulls.c < 0.5 && pulls.a > 1.2, `${type}: una forza dello 0,3% parte molto sotto una del 26% (${pulls.c} contro ${pulls.a}).`);
  }
  assert.deepEqual(partyPulls(field, {}, 'regionale'), {}, 'Senza dati sui pesi non cambia nulla (come prima).');
  assert.deepEqual(partyPulls(field, weights, 'politiche'), {}, 'Nel voto politico il peso è già l’àncora della partenza: nessuna spinta in più.');
  assert.deepEqual(partyPulls(field, weights, 'europee'), {}, 'Anche alle europee.');
  const spread = type => { const pulls = partyPulls(field, weights, type); return pulls.a / pulls.c; };
  assert.ok(spread('comunale') < spread('provinciale') && spread('provinciale') < spread('regionale'), 'Più il voto è di partito (regionale, poi provinciale, poi comunale), più la differenza tra le forze pesa.');
  assert.ok(PARTY_PULL.comunale < PARTY_PULL.provinciale && PARTY_PULL.provinciale < PARTY_PULL.regionale, 'Gli esponenti seguono la natura del voto.');
  lines.push('spinta del partito (pura)');
}

// ---------- 2. campaigns on the real engine ----------
const PARTIES = { forte: 'party-registro-p1-2014-04-ir', medio: 'party-registro-p1-2015-29-ir', debole: 'party-registro-p1-2015-25-ir' };
const PROFILES = { novizio: { popularity: 30, notoriety: 8, influence: 6, experience: 6, consensus: 2 }, noto: { popularity: 72, notoriety: 65, influence: 55, experience: 60, consensus: 18 } };
async function open(type, party, profile, seed) {
  const run = await startCareer({ seed: `${type}-${party}-${profile}-${seed}`, level: 'comunale', partyId: PARTIES[party], fast: true });
  const { store, db } = run;
  const st = store.getState();
  for (const [metric, value] of Object.entries(PROFILES[profile])) { const row = st.dataset.statistics.find(item => item.subjectId === st.career.playerId && item.metric === metric); if (row) row.value = value; else st.dataset.statistics.push({ id: `x-${metric}`, subjectId: st.career.playerId, metric, value, asOf: st.clock.currentDate }); }
  const game = store.getState().game; game.week.ap = Math.max(game.week.ap, 6); game.resources.funds = Math.max(game.resources.funds, 50000);
  if (!store.fastForwardToElection(type)) return null;
  try { store.startCampaign({ electionType: type, objective: 'seat', ...(type === 'politiche' ? { role: 'deputato' } : {}) }, db.parties, { politicians: db.politicians, groups: db.parliamentaryGroups }); } catch { return null; }
  const campaign = store.getState().campaign;
  const weight = campaign.territories.reduce((sum, area) => sum + area.weight, 0);
  const share = id => campaign.territories.reduce((sum, area) => sum + (area.supportByCandidate[id] ?? 0) * area.weight, 0) / weight;
  const me = share(campaign.playerCandidateId);
  const rivals = campaign.candidates.filter(item => !item.isPlayer).map(item => share(item.id));
  const summary = campaignSummary(campaign);
  // what the opening screen shows is the real data of the campaign, and it stays still when nothing is done
  assert.ok(Math.abs(summary.consensus - me) < 0.02 && Math.abs((campaign.expectation?.share ?? me) - me) < 0.02 && Math.abs((campaign.consensusHistory[0]?.value ?? me) - me) < 0.02, `${type}/${party}/${profile}/${seed}: la schermata iniziale (${summary.consensus}), la previsione (${campaign.expectation?.share}) e lo storico (${campaign.consensusHistory[0]?.value}) sono la quota reale (${me.toFixed(2)}).`);
  const before = me;
  store.advance(1);
  const after = store.getState().campaign;
  const afterShare = after?.status === 'active' ? after.territories.reduce((sum, area) => sum + (area.supportByCandidate[after.playerCandidateId] ?? 0) * area.weight, 0) / weight : before;
  assert.ok(Math.abs(afterShare - before) <= 1.6, `${type}/${party}/${profile}/${seed}: dopo un giorno senza azioni la quota passa da ${before.toFixed(1)} a ${afterShare.toFixed(1)}: nessun salto ingiustificato.`);
  const prep = campaign.preparation ?? {};
  return { type, party, profile, seed, me, rivalMean: rivals.reduce((a, b) => a + b, 0) / rivals.length, rivalMax: Math.max(...rivals), pollShare: prep.pollShare ?? null, pollBonus: prep.pollBonus, parts: prep.pollParts ?? null, field: campaign.candidates.length };
}
const rows = [];
const TYPES = ['comunale', 'provinciale', 'regionale', 'politiche', 'europee'];
for (const type of TYPES) {
  for (const party of ['forte', 'medio', 'debole']) for (const profile of ['novizio', 'noto']) for (const seed of ['1', '2']) {
    // a provincial seat needs a seat in a comune (the candidacy is refused otherwise): such a cell is skipped, never counted
    const row = await open(type, party, profile, seed);
    if (row) rows.push(row);
  }
}
const mean = list => list.reduce((a, b) => a + b, 0) / (list.length || 1);
const cell = (type, party, profile = null) => rows.filter(row => row.type === type && row.party === party && (!profile || row.profile === profile));
for (const type of TYPES) assert.ok(['forte', 'medio', 'debole'].every(party => cell(type, party).length >= 2), `${type}: abbastanza campagne per ogni forza (${rows.filter(row => row.type === type).length}).`);

for (const type of TYPES) {
  const strong = mean(cell(type, 'forte').map(row => row.me)), middle = mean(cell(type, 'medio').map(row => row.me)), weak = mean(cell(type, 'debole').map(row => row.me));
  assert.ok(strong > middle && middle > weak, `${type}: la quota di partenza segue la forza del partito (forte ${strong.toFixed(1)} · media ${middle.toFixed(1)} · debole ${weak.toFixed(1)}).`);
}
// a weak party (under 1% in the polls): the start is low where the vote is about parties, and never above the weight of the party plus what the candidate brings
for (const row of rows.filter(item => item.party === 'debole')) {
  if (['politiche', 'europee'].includes(row.type)) assert.ok(row.me <= (row.pollShare ?? 0.5) + 1.5, `${row.type}/${row.profile}/${row.seed}: una forza dello ${row.pollShare}% parte a ${row.me.toFixed(1)}%, non molto sopra il suo peso.`);
  else assert.ok(row.me <= Math.min(row.rivalMean * ({ comunale: 0.9, provinciale: 0.55, regionale: 0.4 }[row.type]), row.rivalMax * 0.8), `${row.type}/${row.profile}/${row.seed}: una forza dello ${row.pollShare}% parte a ${row.me.toFixed(1)}% contro una media dei rivali di ${row.rivalMean.toFixed(1)}%.`);
}
// a strong party: the general and European votes start near its weight in the polls (not lifted again by the same weight)
for (const row of rows.filter(item => item.party === 'forte' && ['politiche', 'europee'].includes(item.type))) {
  assert.ok(row.me <= row.pollShare + 4 && row.me >= row.pollShare - 6, `${row.type}/${row.profile}/${row.seed}: ${row.pollShare}% nei sondaggi, ${row.me.toFixed(1)}% alla partenza.`);
  assert.ok(row.parts.allies <= 2 && row.pollBonus <= 2.6, `${row.type}: il bonus dei sondaggi tiene solo gli alleati (${row.pollBonus}), non il peso del partito già nella partenza.`);
}
// a known name of a strong party starts well, a newcomer of a weak one starts low: both ends stay possible
for (const type of ['comunale', 'regionale']) {
  const known = mean(cell(type, 'forte', 'noto').map(row => row.me)), newcomer = mean(cell(type, 'debole', 'novizio').map(row => row.me));
  assert.ok(known - newcomer >= 8, `${type}: un nome noto di un partito forte (${known.toFixed(1)}) parte molto più avanti di un esordiente di uno debole (${newcomer.toFixed(1)}).`);
}
assert.ok(rows.some(row => row.me < 10) && rows.some(row => row.me > 25), 'Si parte anche da un consenso basso, o da uno alto: nessun tetto uguale per tutti.');
// local campaigns stay different from national ones: the weak party is not at the same relative level in a comune and in a region
assert.ok(mean(cell('comunale', 'debole').map(row => row.me / row.rivalMean)) > mean(cell('regionale', 'debole').map(row => row.me / row.rivalMean)), 'Il comune premia il candidato più della regione: la forza debole parte relativamente più in alto.');
// every part of the bonus is listed, the weight of the party is not one of them
for (const row of rows) {
  assert.ok(row.parts && ['allies', 'party', 'mood', 'memory', 'committees', 'start'].every(key => Number.isFinite(row.parts[key])), `${row.type}: le parti del bonus sono elencate.`);
  assert.equal(row.parts.party, 0, `${row.type}: il peso del partito nei sondaggi non si somma una seconda volta.`);
  const total = Object.values(row.parts).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - row.pollBonus) < 0.06, `${row.type}: il bonus (${row.pollBonus}) è la somma delle sue parti (${total.toFixed(2)}).`);
}
lines.push(`${rows.length} campagne su ${TYPES.length} tipi di voto (forti e deboli, esordienti e noti)`);

// ---------- 3. determinism ----------
{
  const again = await open('regionale', 'medio', 'novizio', '1');
  const first = rows.find(row => row.type === 'regionale' && row.party === 'medio' && row.profile === 'novizio' && row.seed === '1');
  if (first && again) assert.equal(again.me.toFixed(4), first.me.toFixed(4), 'Lo stesso seme dà la stessa partenza.');
  lines.push('stesso seme, stessa partenza');
}

const table = TYPES.map(type => `${type}: ${['forte', 'medio', 'debole'].map(party => `${party} ${mean(cell(type, party).map(row => row.me)).toFixed(1)}%`).join(' · ')}`).join(' | ');
console.log(`Partenza delle campagne: ${lines.join('; ')}. Quota media del giocatore — ${table}.`);
