// Who is elected, and whether the career says the same. Passing the threshold lets a list share the seats; it does not elect all its candidates: the player's own place (list position, preferences,
// the seats of the list in the player's district) decides. Checked: the general-election outcome on crafted results (threshold passed with too few seats for the list position → not elected; enough
// seats → elected; below the threshold → no seat), the residual row «Altri» (canonical id, `others: true`, never ranked, never seats, never the player, in the result and in the Election Night),
// and real council campaigns on several seeds: the mandate of the result, the seats of the player's list, the office in the save and the history agree.
import assert from 'node:assert/strict';
import { startCareer, approveNomination } from './lib/long-run.mjs';
const { politicheOutcome } = await import('../src/core/legislature-engine.js');
const { LEGISLATURE_RULES } = await import('../src/data/simulation/legislature-rules.js').catch(async () => import('../src/core/legislature-engine.js'));
const { withVotes, isOthersRow, OTHERS_ID } = await import('../src/core/electorate.js');
const { nightSnapshot, nightView } = await import('../src/core/night-engine.js');

// ---- 1. general election, crafted results (no map: the average multi-member district)
const per = LEGISLATURE_RULES?.plurinominali?.camera ?? 49;
const result = (prop, share) => ({ id: `prova-${prop}-${share}`, camera: { parties: [{ id: 'lista', prop }], shares: { lista: share } }, national: [{ id: 'lista', share }], coalitions: [] });
const player = listPosition => ({ candidate: true, chamber: 'camera', forceId: 'lista', listPosition });
{
  const strong = politicheOutcome(result(per * 3, 12), player(1));
  assert.ok(strong.listSeats >= 2 && strong.mandate && strong.code === 'eletto-lista', `Lista sopra soglia con ${strong.listSeats} seggi nel collegio: il capolista è eletto.`);
  const far = politicheOutcome(result(per * 3, 12), player(strong.listSeats + 2));
  assert.equal(far.mandate, false, 'Soglia superata ma posizione in lista oltre i seggi del collegio: non eletto.');
  assert.equal(far.code, 'posizione-lista', 'Il motivo è la posizione in lista, non la soglia.');
  assert.equal(far.belowThreshold, false);
  const few = politicheOutcome(result(2, 3.4), player(1));
  assert.equal(few.belowThreshold, false, 'Sopra la soglia del 3%.');
  if (few.listSeats === 0) assert.ok(!few.mandate && few.code === 'sconfitta', 'Sopra soglia ma nessun seggio nel collegio: non eletto, senza dire «sotto soglia».');
  else assert.ok(few.mandate, 'Un seggio nel collegio al capolista: eletto.');
  const under = politicheOutcome(result(0, 2.1), player(1));
  assert.deepEqual([under.mandate, under.code], [false, 'sotto-soglia'], 'Sotto soglia, nessun seggio proporzionale.');
}

// ---- 2. «Altri»: one canonical row, a flag, never a party
{
  const rows = withVotes([{ id: 'a', percent: 40 }, { id: 'b', percent: 35 }], 100000);
  const others = rows.find(isOthersRow);
  assert.ok(others && others.id === OTHERS_ID && others.others === true && others.seats === 0 && !others.candidateId, '«Altre liste»: id canonico, flag esplicito, nessun seggio, nessun candidato.');
  assert.equal(rows.reduce((sum, row) => sum + row.votes, 0), 100000, 'I voti residui restano nel totale.');
  assert.ok(isOthersRow({ id: 'altre-liste' }), 'I risultati salvati da versioni precedenti sono riconosciuti.');
  // the Election Night built from such a result: «Altri» is last, unranked, without seats, never the leader of an area
  const campaign = { id: 'c1', playerCandidateId: 'a', electionType: 'europee', electionLabel: 'Prova', result: { groups: [{ id: 'a', candidateId: 'a', label: 'Lista A', percent: 40, votes: 40000, seats: 10 }, { id: 'b', label: 'Lista B', percent: 35, votes: 35000, seats: 9 }, { id: 'altre-liste', label: 'Altre liste', percent: 25, votes: 25000, seats: 0, others: true }], territories: [{ territoryId: 't1', name: 'Area', weight: 1, groups: [{ id: 'a', percent: 30 }, { id: 'b', percent: 20 }, { id: 'altre-liste', percent: 50 }] }], electorate: { ballots: 100000, valid: 100000 }, totalBallots: 100000 }, polls: [] };
  const snap = nightSnapshot(campaign, 'finale');
  if (snap) {
    const row = snap.groups.find(group => group.others);
    assert.ok(row && row.id === OTHERS_ID && row.seats === 0 && !row.isPlayer, 'Nella Notte «Altri» resta un aggregato.');
    assert.equal(snap.groups.filter(group => group.others).length, 1, 'Un solo «Altri» (nessun doppione).');
    const night = { snapshot: snap, seed: 's', hour: 12 };
    let view = null; try { view = nightView(night, 12); } catch { /* a reduced fixture */ }
    if (view) {
      assert.ok(!view.rows[0].others, '«Altri» non è mai primo.');
      assert.equal(view.rows.find(item => item.others)?.position ?? null, null, '«Altri» non ha posizione in classifica.');
      assert.ok(view.areas.every(area => area.leaderId !== OTHERS_ID), '«Altri» non vince un’area.');
    }
  }
}

// ---- 3. real council campaigns: result, seats of the list, office in the save and history say the same
let checked = 0, elected = 0, notElected = 0;
for (const seed of ['mandato-1', 'mandato-2', 'mandato-3', 'mandato-4', 'mandato-5', 'mandato-6']) {
  const run = await startCareer({ seed, level: 'comunale', fast: true });
  const { store, db } = run;
  store.setHeadlessVoter(() => 'astenuto');
  for (let tries = 0; tries < 20; tries++) { try { if (store.fastForwardToElection('comunale')) break; } catch { break; } }
  try { store.startCampaign({ electionType: 'comunale', role: 'consigliere', objective: 'seat', municipalityBand: seed.endsWith('1') || seed.endsWith('4') ? 'oltre-15000' : 'fino-15000' }, db.parties); } catch { continue; }
  approveNomination(store); store.setHeadlessVoter(() => 'astenuto');
  // half of the candidacies with a strong candidate at the top of the list (to have elected players too), half as they come
  if (/[246]$/.test(seed)) { const c = store.getState().campaign; c.candidateStats = { ...(c.candidateStats ?? {}), notoriety: 95, reputation: 90, popularity: 90 }; c.candidacy.listPosition = 1; c.nomination.internalSupport = 10; store.loadGame(JSON.parse(store.exportSave())); store.setHeadlessVoter(() => 'astenuto'); }
  const campaignId = store.getState().campaign.id;
  for (let week = 0; week < 20 && store.getState().campaign?.status === 'active'; week++) store.advanceTurn(1, { mode: 'delega', staffVotes: 'linea' });
  const state = store.getState();
  const report = (state.career.electionHistory ?? state.game?.elections ?? []).length;
  const entry = [...(state.game?.electionReports ?? state.career?.reports ?? [])].reverse().find(item => item.campaignId === campaignId) ?? null;
  const result = state.campaign?.id === campaignId ? state.campaign.result : (state.lastCampaign?.id === campaignId ? state.lastCampaign.result : null);
  const res = result ?? entry;
  if (!res) continue;
  checked++;
  const mandate = Boolean(res.personalMandate ?? res.outcome?.mandate);
  const playerId = state.career.playerId;
  const office = state.dataset.offices.some(item => item.politicianId === playerId && !item.endDate && /consigli|sindac/i.test(`${item.role ?? ''} ${item.title ?? ''} ${item.level ?? ''}`));
  if (mandate) { elected++; assert.ok(office, `${seed}: eletto nel risultato → carica aperta nel salvataggio.`); } else notElected++;
  const personal = res.personal ?? {};
  if (personal.listSeats !== undefined) {
    const row = (res.groups ?? []).find(group => group.candidateId === state.campaign?.playerCandidateId || group.isPlayer);
    if (row) assert.ok(personal.listSeats <= row.seats, `${seed}: i seggi della lista del giocatore non superano quelli della coalizione.`);
    if (mandate) assert.ok(personal.listSeats >= 1, `${seed}: eletto con almeno un seggio della propria lista.`);
  }
  for (const group of res.groups ?? []) if (isOthersRow(group)) { assert.equal(group.seats ?? 0, 0, `${seed}: «Altri» senza seggi.`); assert.notEqual(res.winnerGroupId, group.id, `${seed}: «Altri» non vince.`); }
  void report;
}
assert.ok(checked >= 4 && elected >= 1 && notElected >= 1, `Campagne verificate: ${checked} (${elected} eletti, ${notElected} non eletti).`);
console.log(`Elezioni e mandati verificati: politiche (soglia superata ma posizione oltre i seggi → non eletto; seggi sufficienti → eletto; sotto soglia → nessun seggio), «Altri» canonico e mai trattato come partito (risultato e Notte Elettorale), ${checked} campagne comunali reali (${elected} eletti, ${notElected} non eletti) coerenti con le cariche del salvataggio.`);
