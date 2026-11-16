// A campaign without a candidacy (the party does not nominate the player: «excluded»): the participation is closed, the campaign closes by itself with the outcome «escluso» and an explanation,
// nothing waits for the player (no pending nomination, no ballot, no night), the career goes on as an ordinary career, and the next election can be prepared («campaign-new») with no residual state.
import assert from 'node:assert/strict';
import { startCareer } from './lib/long-run.mjs';

const { store } = await startCareer({ seed: 'esclusione', level: 'deputato', fast: true });
store.setHeadlessVoter(null);
const s0 = store.getState();
s0.game.resources.politicalCapital = 40; s0.game.resources.funds = 10000;
const { openVotesOf } = await import('../src/core/lawmaking-engine.js');
const clearInbox = () => { for (const item of store.getState().game.inbox.filter(entry => ['urgente', 'situazione'].includes(entry.kind))) for (const choice of item.choices ?? []) { try { store.resolveAgendaItem(item.id, choice.id); break; } catch { /* next */ } } };
for (let n = 0; n < 200; n++) {
  const target = store.getState().game.elections.find(item => item.type === 'politiche' && item.status !== 'held');
  if (target && store.getState().clock.currentDate >= target.windowOpensAt) break;
  clearInbox(); for (const vote of openVotesOf(store.getState())) { try { store.castOpenVote(vote.id, 'astenuto'); } catch { /* */ } }
  store.advanceTurn(1, { delegate: true });
}
const parties = s0.dataset?.parties ?? [];
store.startCampaign({ electionType: 'politiche', role: 'deputato', objective: 'build' }, parties);
let campaign = store.getState().campaign;
assert.equal(campaign.status, 'active', 'La campagna parte.');
// the party refuses the candidacy
campaign.nomination.status = 'excluded';
campaign.candidates.find(item => item.isPlayer).status = 'eliminated';
const clear = () => { for (const item of store.getState().game.inbox.filter(entry => ['urgente', 'situazione'].includes(entry.kind))) for (const choice of item.choices ?? []) { try { store.resolveAgendaItem(item.id, choice.id); break; } catch { /* next */ } } };
let guard = 0;
while (store.getState().campaign?.status === 'active' && guard++ < 80) { clear(); for (const vote of (await import('../src/core/lawmaking-engine.js')).openVotesOf(store.getState())) { try { store.castOpenVote(vote.id, 'astenuto'); } catch { /* */ } } store.advanceTurn(1, { delegate: true }); }
campaign = store.getState().campaign;
assert.equal(campaign.status, 'finished', `La campagna si chiude da sola (${guard} settimane).`);
assert.equal(campaign.result?.outcome?.code, 'escluso', 'L’esito è «escluso dalla candidatura».');
assert.ok(String(campaign.result.outcome.text ?? campaign.result.outcome.message ?? '').length > 15 || campaign.history.some(item => /candidatura/i.test(item.text)), 'L’esclusione è spiegata.');
assert.ok(!store.getState().night, 'Nessuna notte elettorale da giocare per chi non è candidato.');
assert.equal(store.getState().game.status, 'active', 'La carriera continua.');
assert.equal(store.getState().game.inbox.filter(item => /candidatura del partito|nomina/i.test(item.title ?? '')).length, 0, 'Niente richieste di candidatura ancora in sospeso.');
// the next election can be prepared: the finished campaign is emptied
const hadAction = typeof store.clearCampaign === 'function' || typeof store.newCampaign === 'function';
if (hadAction) { (store.clearCampaign ?? store.newCampaign).call(store); assert.equal(store.getState().campaign, null, 'Dopo «Prepara una nuova elezione» non resta nessuna campagna.'); }
// and the advance of the career goes on without being stopped by the old campaign
const report = store.advanceTurn(2, { delegate: true });
assert.ok(report.weeks >= 1 && report.reason !== 'campagna', 'L’avanzamento non è fermato dalla campagna chiusa.');
console.log('Campagna senza candidatura verificata: partecipazione chiusa, esito «escluso» spiegato, nessuna notte né richiesta in sospeso, carriera attiva, nuova elezione preparabile, avanzamento libero.');
