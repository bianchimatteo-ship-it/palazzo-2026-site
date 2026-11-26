// A candidacy the party does not confirm takes the player out of the campaign at once. Before the fix evaluateNomination marked the nomination «excluded» but left the campaign active: the player stayed
// in the screens and the flow of the campaign until the vote, with a Notte Elettorale for a race never entered. Checked on the real store with the real data:
//   1. a campaign whose nomination the party refuses: the campaign closes on the day of the decision (no campaign in the state, nothing to do in it), no Notte Elettorale, the vote is «missed» for the
//      player and is held for the others, the money and the capital the campaign had not spent go back to the career, the history keeps the outcome and the reason, the diary says it, the weeks go on;
//   2. the candidacy no longer holds the round: the next vote can be run;
//   3. save and reload keep all of it;
//   4. an old save with a campaign still active for an excluded nomination is closed in the same way when it is loaded.
import assert from 'node:assert/strict';
import { startCareer } from './lib/long-run.mjs';
const problems = [];
const check = (ok, text) => { if (!ok) problems.push(text); };
const TYPES = ['regionale', 'comunale', 'provinciale'];
const ROLE = { comunale: 'consigliere', provinciale: 'consigliere', regionale: 'consigliere' };

async function excludedCampaign(seed) {
  const { store, db } = await startCareer({ seed, level: 'comunale', fast: true, territorial: true });
  const st = () => store.getState();
  for (const type of TYPES) {
    try { store.fastForwardToElection(type); } catch { continue; }
    const election = st().game.elections.find(item => item.type === type && item.status === 'open');
    if (!election) continue;
    try { store.startCampaign({ electionType: type, role: ROLE[type], electionId: election.id, objective: 'seat' }, db.parties); } catch { continue; }
    if (st().campaign?.nomination?.status !== 'pending') { store.clearCampaign?.(); continue; }
    // the party leans to someone else: no internal support, a strong internal rival, the decision due tomorrow
    const saved = JSON.parse(store.exportSave());
    saved.campaign.nomination = { ...saved.campaign.nomination, internalSupport: 0, requiredSupport: 9, deadlineDay: saved.campaign.day + 1 };
    saved.campaign.internalCandidates = [...(saved.campaign.internalCandidates ?? []), { id: 'rivale-interno-prova', name: 'Rivale interno', internalSupport: 9 }];
    store.loadGame(saved);
    return { store, db, st, election, type };
  }
  return null;
}

let ctx = null;
for (const seed of ['esclusione-a', 'esclusione-b', 'esclusione-c', 'esclusione-d']) { ctx = await excludedCampaign(seed); if (ctx) break; }
if (!ctx) problems.push('Nessuna campagna con candidatura da confermare raggiungibile per la prova.');
else {
  const { store, st, election } = ctx;
  store.setElectionNightLive(true);
  const before = st();
  const fundsBefore = before.game.resources.funds, capitalBefore = before.game.resources.politicalCapital;
  const campaignMoney = before.campaign.candidates.find(item => item.isPlayer).resources.money;
  const campaignId = before.campaign.id;
  store.advance(1);
  const after = st();
  check(after.campaign === null, `La campagna si chiude subito dopo l’esclusione (stato: ${after.campaign?.status}).`);
  check(!after.night, 'Nessuna Notte Elettorale per una corsa mai disputata.');
  const entry = (after.career.electionHistory ?? []).find(item => item.campaignId === campaignId);
  check(entry?.outcome === 'escluso' && entry.excluded && entry.reason?.length > 10 && entry.personalMandate === false, 'Lo storico conserva l’esclusione con la motivazione.');
  check(after.career.lastCampaignId === campaignId, 'La chiusura è registrata una sola volta.');
  const vote = after.game.elections.find(item => item.id === election.id);
  check(vote?.status === 'missed' && !vote.campaignId, `L’elezione resta in calendario senza il giocatore (stato ${vote?.status}).`);
  check(!(after.game.candidacies ?? []).some(item => item.id === election.id), 'La candidatura non occupa più il turno elettorale.');
  check(after.game.resources.funds >= fundsBefore + Math.max(0, campaignMoney - 2000), `I fondi non spesi tornano alla carriera (${fundsBefore} → ${after.game.resources.funds}, cassa della campagna ${campaignMoney}).`);
  check(after.game.resources.politicalCapital >= capitalBefore, 'Il capitale politico della campagna torna alla carriera.');
  check(after.game.log.some(item => item.id === `diario-esclusione-${campaignId}`), 'Il diario racconta l’esclusione.');
  // the ordinary career goes on, nothing of the campaign is waited for
  for (let n = 0; n < 6; n++) { try { store.advance(1); } catch (error) { problems.push(`Dopo l’esclusione l’avanzamento si ferma (${error.message})`); break; } if (st().campaign) { problems.push('Una campagna ricompare dopo l’esclusione.'); break; } }
  // the vote is held for the others when its day comes
  for (let n = 0; n < 40 && st().game.elections.find(item => item.id === election.id)?.status !== 'held'; n++) { try { store.advance(1); } catch { break; } }
  check(st().game.elections.find(item => item.id === election.id)?.status === 'held', 'L’elezione si tiene senza il giocatore al suo giorno.');
  // save and reload
  const reloaded = JSON.parse(store.exportSave()); store.loadGame(reloaded);
  check(st().campaign === null && st().career.electionHistory.some(item => item.campaignId === campaignId && item.outcome === 'escluso'), 'Dopo il ricaricamento lo stato resta coerente.');
  // a later vote can be run
  let next = null; for (const type of TYPES) { try { store.fastForwardToElection(type); } catch { continue; } next = st().game.elections.find(item => item.type === type && item.status === 'open'); if (next) break; }
  if (next) { try { store.startCampaign({ electionType: next.type, role: ROLE[next.type], electionId: next.id, objective: 'seat' }, ctx.db.parties); check(st().campaign?.status === 'active', 'Ci si può candidare all’elezione successiva.'); } catch (error) { check(!/campagna|turno|sovrappon/i.test(error.message), `L’elezione successiva non è bloccata dalla candidatura esclusa (${error.message}).`); } }
}
// 4. an old save: an active campaign with an excluded nomination
{
  const old = await excludedCampaign('esclusione-vecchio') ?? await excludedCampaign('esclusione-a');
  if (old) {
    const saved = JSON.parse(old.store.exportSave());
    saved.campaign.nomination.status = 'excluded';
    saved.campaign.candidates.find(item => item.isPlayer).status = 'eliminated';
    const id = saved.campaign.id;
    old.store.loadGame(saved);
    check(old.st().campaign === null, 'Vecchio salvataggio: la campagna attiva con candidatura esclusa viene chiusa al caricamento.');
    check(old.st().career.electionHistory.some(item => item.campaignId === id && item.outcome === 'escluso'), 'Vecchio salvataggio: l’esclusione entra nello storico.');
    try { old.store.advance(1); old.store.advance(1); } catch (error) { problems.push(`Vecchio salvataggio: l’avanzamento si ferma (${error.message})`); }
  }
}
if (problems.length) { console.error(`Candidatura esclusa — problemi:\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`Candidatura esclusa verificata (${ctx.type}): la campagna si chiude il giorno della decisione, niente Notte Elettorale, voto «missed» per il giocatore e tenuto per gli altri, fondi e capitale non spesi restituiti, storico e diario con la motivazione, avanzamento regolare, ricaricamento coerente, elezione successiva disponibile; i vecchi salvataggi vengono chiusi allo stesso modo.`);
