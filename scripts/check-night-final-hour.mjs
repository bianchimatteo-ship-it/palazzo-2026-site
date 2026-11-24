// The final result of a Notte Elettorale comes only at the twelfth hour. Before the fix the provincial curve reached the whole count at the tenth hour and the runoff at the eleventh: the night showed
// «Risultato definitivo» and the final seats with hours still to go. Checked:
//   1. the tables of every kind of vote: below the whole count until the eleventh hour, the whole count at the twelfth;
//   2. a real provincial night (the store, the real data): at the tenth and eleventh hour the count is partial, the projection is an estimate, the seats are provisional; at the twelfth the count is
//      complete and the projection coincides with the official result; the night is concluded only by the player (night.concluded);
//   3. a runoff night (the same campaign read as a runoff): at the eleventh hour still partial, at the twelfth complete;
//   4. the other kinds of vote (comunale, regionale, politiche, europee) from the same tables.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const N = await import(new URL(`../src/core/night-engine.js?v=${build}`, import.meta.url).href);
const problems = [];
const check = (ok, text) => { if (!ok) problems.push(text); };
// 1. the tables
for (const [key, curve] of Object.entries(N.nightCurves())) {
  check(curve.length === N.NIGHT_HOURS, `${key}: una quota per ognuna delle ${N.NIGHT_HOURS} ore.`);
  curve.slice(0, -1).forEach((value, index) => check(value < 1, `${key}: alla ${index + 1}ª ora lo scrutinio non è ancora completo (${value}).`));
  check(curve.at(-1) === 1, `${key}: alla dodicesima ora lo scrutinio è completo.`);
  curve.forEach((value, index) => check(index === 0 || value >= curve[index - 1], `${key}: la quota non cala alla ${index + 1}ª ora.`));
}
// 2. a real provincial night
const night = async () => {
  for (const seed of ['notte-prov-a', 'notte-prov-b', 'notte-prov-c', 'prov-a', 'prov-b']) {
    const { store, db } = await startCareer({ seed, level: 'comunale', fast: true, territorial: true });
    const st = () => store.getState();
    try { store.fastForwardToElection('provinciale'); } catch { continue; }
    const election = st().game.elections.find(item => item.type === 'provinciale' && item.status === 'open');
    if (!election) continue;
    try { store.startCampaign({ electionType: 'provinciale', role: 'consigliere', objective: 'seat', electionId: election.id }, db.parties); } catch { continue; }
    st().campaign.nomination.status = 'approved';
    store.setElectionNightLive(true);
    for (let guard = 0; guard < 200 && st().campaign?.status === 'active' && !st().night; guard++) {
      for (const event of [...(st().campaign?.pendingEvents ?? [])]) store.decideCampaignEvent(event.id, event.choices[0].id);
      for (let g = 0; g < 4 && st().scene; g++) { try { store.sceneSkip(); } catch { try { store.sceneAbandon(); } catch { break; } } }
      if (!st().night) store.advance(1);
    }
    for (let g = 0; g < 4 && st().scene; g++) { try { store.sceneSkip(); } catch { try { store.sceneAbandon(); } catch { break; } } }
    if (st().night) return { store, st, campaign: JSON.parse(JSON.stringify(st().campaign)) };
  }
  return null;
};
const found = await night();
if (!found) problems.push('Nessuna Notte Elettorale provinciale raggiungibile per la prova.');
else {
  const { store, st, campaign } = found;
  check(st().night.electionType === 'provinciale' || st().night.snapshot?.electionType === 'provinciale', 'La notte è quella del voto provinciale.');
  const seen = {};
  for (let guard = 0; guard < 14 && st().night.hour < N.NIGHT_HOURS; guard++) {
    store.advanceElectionNight();
    const n = st().night, view = N.nightView(n, n.hour), proj = N.projection(n, view);
    seen[n.hour] = { complete: view.complete, official: proj.official, counted: view.counted, units: view.units, concluded: n.concluded };
  }
  for (const hour of [10, 11]) {
    const at = seen[hour];
    check(at && !at.complete && at.counted < at.units, `Provinciali, ora ${hour}: lo scrutinio è ancora parziale (${at?.counted}/${at?.units}).`);
    check(at && !at.official, `Provinciali, ora ${hour}: proiezione e seggi restano stime, non il risultato definitivo.`);
    check(at && !at.concluded, `Provinciali, ora ${hour}: la notte non è conclusa.`);
  }
  check(seen[12]?.complete && seen[12]?.official, 'Provinciali, ora 12: scrutinio completo, il risultato definitivo coincide con quello ufficiale.');
  check(!st().night.concluded, 'La notte si chiude solo con «Concludi» (night.concluded).');
  store.concludeElectionNight();
  check(!st().night, 'Concludere la notte la chiude.');
  // 3. the same race read as a runoff
  if (campaign.result) {
    const runoffCampaign = { ...campaign, firstRoundResult: { ...campaign.result, requiresRunoff: true } };
    let runoff = N.createNight(runoffCampaign, 'finale');
    check(runoff && N.nightSchedule('provinciale', 'finale', true).key === 'ballottaggio', 'La notte di un ballottaggio usa la curva del ballottaggio.');
    if (runoff) {
      for (let hour = 2; hour <= 11; hour++) runoff = N.advanceNight(runoff);
      const at11 = N.nightView(runoff, 11);
      check(runoff.hour === 11 && !at11.complete && !N.projection(runoff, at11).official, `Ballottaggio, ora 11: ancora parziale (${at11.counted}/${at11.units}).`);
      runoff = N.advanceNight(runoff);
      check(N.nightView(runoff, 12).complete, 'Ballottaggio, ora 12: scrutinio completo.');
    }
  }
}
if (problems.length) { console.error(`Notte Elettorale, risultato finale alla dodicesima ora — problemi:\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`Notte Elettorale verificata: in tutte le curve (${Object.keys(N.nightCurves()).join(', ')}) lo scrutinio si completa solo alla dodicesima ora; nella notte provinciale reale alle ore 10 e 11 lo scrutinio, la proiezione e i seggi sono parziali e diventano definitivi alla 12; il ballottaggio è parziale all’undicesima ora; la chiusura resta affidata a night.concluded.`);
