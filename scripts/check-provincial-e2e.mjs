// Campagna provinciale dall'inizio alla fine su più carriere: requisiti, candidatura, preparazione, campagna, avanzamento, voto di secondo livello, Notte Elettorale (anche con il Notte attiva), esito (vittoria o sconfitta),
// seggio e incarico provinciale, storico, salvataggio e ricaricamento. Il test deve vedere almeno una vittoria e una sconfitta (altrimenti prova altre carriere).
import assert from 'node:assert/strict';
import { startCareer } from './lib/long-run.mjs';
const outcomes = [];
const run = async seed => {
  const { store, db } = await startCareer({ seed, level: 'comunale', fast: true, territorial: true });
  const state = () => store.getState();
  store.setElectionNightLive(true);
  let open = null; try { open = store.fastForwardToElection('provinciale'); } catch { open = null; }
  if (!open) return null;
  const election = state().game.elections.find(item => item.type === 'provinciale' && item.status === 'open');
  if (!election) return null;
  state().game.resources = { ...state().game.resources, funds: 30000, politicalCapital: 40 };
  // a well-known councillor: the vote of second level is decided by the mayors and councillors who know him
  if (process.env.PROV_STRONG !== '0' && seed.endsWith('-w')) for (const stat of state().dataset.statistics) if (stat.subjectId === state().career.playerId && ['notoriety', 'reputation', 'influence', 'experience', 'popularity', 'consensus'].includes(stat.metric)) stat.value = 92;
  const seatsBefore = state().dataset.offices.filter(item => item.politicianId === state().career.playerId && !item.endDate).length;
  try { store.startCampaign({ electionType: 'provinciale', role: 'consigliere', objective: 'win', electionId: election.id }, db.parties); } catch (error) { assert.ok(error.message.length > 20, `Il rifiuto della candidatura è spiegato (${error.message}).`); return { seed, refused: error.message }; }
  assert.equal(state().campaign.electionType, 'provinciale'); assert.equal(state().campaign.electorate?.sizeClass, 'secondo-livello', 'L’elettorato è quello di secondo livello (sindaci e consiglieri).');
  state().campaign.nomination.status = 'approved';
  // preparation: activities during the campaign
  for (let i = 0; i < 9 && state().campaign.status === 'active'; i++) { for (const activity of ['citizen_meeting', 'door_to_door', 'party_meeting']) try { store.performCampaignActivity(activity, { territoryId: state().campaign.territories[0].id }); } catch { /* not affordable */ } for (const event of [...(state().campaign.pendingEvents ?? [])]) store.decideCampaignEvent(event.id, event.choices[0].id); store.advance(3); }
  let guard = 0, sawNight = false;
  while (guard++ < 200 && (state().campaign?.status === 'active' || state().night)) {
    for (const event of [...(state().campaign?.pendingEvents ?? [])]) store.decideCampaignEvent(event.id, event.choices[0].id);
    if (state().night) {
      sawNight = true;
      assert.equal(state().night.electionType ?? 'provinciale', 'provinciale', 'La notte è quella del voto provinciale.');
      for (let h = 0; h < 14 && state().night.hour < 12; h++) store.advanceElectionNight();
      store.concludeElectionNight();
      continue;
    }
    store.advance(1);
  }
  const campaign = state().campaign;
  assert.equal(campaign?.status, 'finished', `${seed}: la campagna è conclusa.`);
  const result = campaign.result;
  assert.ok(result && result.groups?.length >= 2 && Number.isFinite(result.playerShare), `${seed}: il risultato ha liste e quota del giocatore.`);
  const won = result.outcome?.mandate === true;
  const seat = state().dataset.offices.some(item => item.politicianId === state().career.playerId && /provinc/i.test(`${item.title ?? ''} ${item.level ?? ''}`) && !item.endDate);
  const council = (state().local?.institutions ?? []).some(item => item.kind === 'provincia' && item.status === 'active');
  assert.ok(state().career.lastCampaignId === campaign.id, `${seed}: l’esito è registrato nello storico (campagna ${campaign.id}).`);
  const saved = JSON.parse(store.exportSave()); store.loadGame(saved);
  assert.equal(state().campaign?.result?.playerShare, result.playerShare, 'Dopo il ricaricamento il risultato è lo stesso.');
  assert.equal(state().career.lastCampaignId, campaign.id);
  return { seed, code: result.outcome?.code ?? null, won, seat, council, sawNight, share: result.playerShare };
};
for (const seed of ['prov-a', 'prov-b', 'prov-c', 'prov-d', 'prov-e', 'prov-f', 'prov-g', 'prov-h', 'prov-i', 'prov-l', 'prov-a-w', 'prov-b-w', 'prov-c-w', 'prov-d-w']) { const out = await run(seed); if (out) outcomes.push(out); const ok = outcomes.filter(item => !item.refused); if (ok.some(item => item.won) && ok.some(item => !item.won)) break; }
const done = outcomes.filter(item => !item.refused);
assert.ok(done.length >= 2, `Almeno due campagne provinciali concluse (${done.length}; rifiutate: ${outcomes.filter(item => item.refused).map(item => item.refused).join(' | ')}).`);
assert.ok(done.some(item => item.won) && done.some(item => !item.won), `Almeno una vittoria e una sconfitta (esiti: ${done.map(item => item.won ? 'vittoria' : 'sconfitta').join(', ')}).`);
assert.ok(done.every(item => item.sawNight), 'Ogni campagna provinciale ha la sua Notte Elettorale.');
for (const item of done) if (item.won) assert.ok(item.seat || item.council, `${item.seed}: chi vince ha il seggio provinciale.`); else assert.ok(!item.seat, `${item.seed}: chi perde non ha un seggio provinciale inventato.`);
console.log(`Campagna provinciale end-to-end: ${done.length} carriere (${done.filter(item => item.won).length} vittorie, ${done.filter(item => !item.won).length} sconfitte; esiti: ${done.map(item => `${item.code ?? '?'} ${item.share}%`).join(', ')}), Notte Elettorale, seggio, storico, salvataggio e ricaricamento.`);
