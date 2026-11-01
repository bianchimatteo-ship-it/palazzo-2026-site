import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}?v=${build}`, import.meta.url).href);
const { aggregateShares } = await module('src/core/election-engine.js');
const kind = process.argv[2] ?? 'regionale', role = process.argv[3] ?? 'consigliere', level = process.argv[4] ?? 'regionale', seedN = process.argv[5] ?? '1';
const PLAY = ['associations', 'territory_campaign', 'local_life', 'local_visit', 'interview', 'debate_prep', 'rally', 'door_to_door', 'territorial_pact', 'volunteer_training', 'citizen_meeting'];
const PLAY_OLD = ['rally', 'social', 'door_to_door', 'citizen_meeting', 'interview', 'public_event', 'debate', 'press_conference', 'social_ads', 'posters', 'local_visit', 'territory_campaign'];
const run = await startCareer({ seed: `probe-${kind}-${seedN}`, level, territorial: ['comunale', 'provinciale'].includes(kind), fast: true });
const { store, db } = run;
const open = store.fastForwardToElection(kind);
store.startCampaign({ electionType: kind, role, objective: 'win', ...(kind === 'comunale' ? { municipalityBand: 'oltre-15000' } : {}) }, db.parties);
store.getState().campaign.nomination.status = 'approved';
let performed = 0, guard = 0; const rows = [];
const mine = c => { const g = aggregateShares(c).find(x => x.id === c.playerCandidateId); return g?.share ?? null; };
while (store.getState().campaign?.status === 'active' && guard++ < 200) {
  let c = store.getState().campaign;
  for (const event of [...(c.pendingEvents ?? [])]) store.decideCampaignEvent(event.id, event.choices[0].id);
  { const g = store.getState().game; g.week.ap = 8; g.resources.politicalCapital = 50; g.resources.funds = 90000; const cp = store.getState().campaign.candidates.find(x => x.isPlayer); if (cp) { cp.resources.money = 90000; cp.resources.politicalCapital = 99; cp.resources.volunteers = 80; cp.resources.volunteers = Math.max(cp.resources.volunteers ?? 0, 60); } }
  for (let i = 0; i < 14; i++) { { const cp2 = store.getState().campaign.candidates.find(x => x.isPlayer); Object.assign(cp2.resources, { money: 90000, volunteers: 90, organization: 90, politicalCapital: 99 }); } try { store.performCampaignActivity(PLAY[performed % PLAY.length], { territoryId: store.getState().campaign.territories[performed % store.getState().campaign.territories.length].id }); performed++; } catch (e) { if (false) console.log('day', c.day, PLAY[performed % PLAY.length], String(e.message).slice(0, 90)); break; } }
  c = store.getState().campaign; if (c.status !== 'active') break;
  const poll = c.polls?.at(-1); const row = poll?.results?.find(r => r.candidateId === c.playerCandidateId);
  if (true) rows.push([c.day, mine(c)?.toFixed(2), row ? row.share : '-', poll?.day ?? '-']);
  store.advance(1);
}
const campaign = store.getState().campaign;
console.log(kind, 'totalDays', campaign.totalDays, 'activities', performed); console.log('day / projection / poll / poll day'); for (const r of rows) console.log(r.join('  '));
console.log('result', campaign.result?.playerShare ?? campaign.firstRoundResult?.playerShare);
process.exit(0);
