import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}?v=${build}`, import.meta.url).href);
const { aggregateShares } = await module('src/core/election-engine.js');
const rules = await module('src/data/simulation/campaign-rules.js');
const kind = 'comunale';
const run = await startCareer({ seed: `probe-gain`, level: 'comunale', territorial: true, fast: true });
const { store, db } = run;
store.fastForwardToElection(kind);
store.startCampaign({ electionType: kind, role: 'sindaco', objective: 'win', municipalityBand: 'oltre-15000' }, db.parties);
store.getState().campaign.nomination.status = 'approved';
const raw = JSON.stringify(store.getState().campaign);
const mine = c => aggregateShares(c).find(x => x.id === c.playerCandidateId)?.share ?? 0;
const base = mine(store.getState().campaign);
console.log('start', base.toFixed(2), 'AP', store.getState().game?.week?.ap, 'money', store.getState().campaign.candidates.find(c => c.isPlayer)?.resources);
const rows = [];
for (const a of rules.CAMPAIGN_ACTIVITIES) {
  const s = store.exportSave(); 
  try { store.performCampaignActivity(a.id, { territoryId: store.getState().campaign.territories[0].id }); rows.push([a.id, (mine(store.getState().campaign) - base).toFixed(3)]); } catch (e) { rows.push([a.id, 'x ' + String(e.message).slice(0, 30)]); }
  store.loadGame(JSON.parse(s));
}
console.log(rows.map(r => r.join(':')).join('  '));
process.exit(0);
