// A coalition registered for an election makes its parties stand TOGETHER at that vote: not only the record of the approval, the race itself. Checked on the real store with the real data, for
// every kind of vote the player can run in (comunali, provinciali, regionali, politiche, europee):
//   registered    the partners stand in the race beside the player (in a local race they get their lists even when the draw of the field would not have fielded them), allied from day one, and the
//                 result counts them in the player's coalition (one row with their candidacies; at a general or European vote the coalition of the national result holds them); the Notte Elettorale
//                 is drawn from that same result; save and reload keep it.
//   not registered an alliance that is not registered for that vote is not a coalition: nobody is allied by default;
//   refused       a registration refused (cohesion too low) does nothing;
//   other vote    a registration for another election does nothing for this one;
//   members       once the members change (a force joins: the merger of accords works the same way), the approval no longer stands until it is given again; once given again the new member stands too;
//   window        after the filing of the lists the coalition cannot be registered;
//   refusal       a force that refused to join is not in the coalition.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const L = await import(new URL(`../src/core/legislature-engine.js?v=${build}`, import.meta.url).href);
const problems = [];
const check = (ok, text) => { if (!ok) problems.push(text); };
const FOUNDER = { partyMode: 'new', partyId: '', partyName: 'Partito della Prova', partyAbbreviation: 'PDP', partyDescription: 'Partito simulato di prova', partyColor: '#264d82', partyOrientation: 'Centrismo civico', startingRole: null };
const ROLE = { comunale: 'sindaco', provinciale: 'consigliere', regionale: 'consigliere', politiche: 'deputato', europee: 'eurodeputato' };

async function setup(type, seed, { partners = 2, cohesion = 70 } = {}) {
  const { store, db } = await startCareer({ seed, level: { politiche: 'deputato', europee: 'europeo' }[type] ?? 'comunale', fast: true, territorial: true, draft: FOUNDER });
  const st = () => store.getState();
  try { store.fastForwardToElection(type); } catch { /* the vote may be open already */ }
  const election = st().game.elections.find(item => item.type === type && item.status === 'open');
  if (!election) return null;
  const world = st().world;
  const me = world.playerPartyId;
  const pollIds = new Set((world.polls?.at(-1)?.results ?? []).map(row => row.partyId));
  // partners the vote can field: at a national vote the forces of the polls (the roster), elsewhere any active party, never at the extremes; by this time of the career most forces are in accords
  // of the world, so the partners leave theirs first (as they would to join the player: an accord left with one member ends)
  const pool = world.parties.filter(item => item.active && !item.isPlayer && (!['politiche', 'europee'].includes(type) || pollIds.has(item.id)) && !/estrema/.test(item.position ?? '')).sort((a, b) => /centro/.test(b.position ?? '') - /centro/.test(a.position ?? ''));
  const chosen = pool.slice(0, partners).map(item => item.id);
  if (chosen.length < partners) return null;
  const saved = JSON.parse(store.exportSave());
  for (const alliance of saved.world.alliances) {
    if (alliance.status !== 'active' || !alliance.partyIds.some(id => chosen.includes(id) || id === me)) continue;
    alliance.partyIds = alliance.partyIds.filter(id => !chosen.includes(id) && id !== me);
    if (alliance.partyIds.length < 2) alliance.status = 'ended';
  }
  saved.world.alliances.push({ id: `alleanza-giocatore-${seed}`, label: 'Alleanza della prova', kind: 'alleanza', coalitions: [], partyIds: [me, ...chosen], cohesion, since: st().clock.currentDate, status: 'active', withPlayer: true, source: 'simulazione' });
  saved.game.resources.politicalCapital = 60; saved.game.resources.funds = 40000;
  store.loadGame(saved);
  return { store, db, st, election, me, partners: chosen, pool, allianceId: `alleanza-giocatore-${seed}` };
}
async function setupAny(type, base, options) { for (const seed of [base, `${base}-2`, `${base}-3`, 'coal-comunale-a', 'coal-comunale-b']) { const ctx = await setup(type, seed, options); if (ctx) return ctx; } return null; }
const start = ({ store, db, election }, type) => store.startCampaign({ electionType: type, role: ROLE[type], electionId: election.id, objective: 'win' }, db.parties);
const alliedIn = (campaign, partners) => partners.filter(id => campaign.candidates.some(item => item.partyId === id && item.status === 'allied' && item.coalitionLeaderId === campaign.playerCandidateId));
const fieldedIn = (campaign, partners) => partners.filter(id => campaign.candidates.some(item => item.partyId === id));
function finish(ctx) {
  const { store, st } = ctx;
  st().campaign.nomination.status = 'approved';
  store.setElectionNightLive(true);
  let guard = 0, night = null;
  while (guard++ < 300 && (st().campaign?.status === 'active' || st().night)) {
    for (const event of [...(st().campaign?.pendingEvents ?? [])]) store.decideCampaignEvent(event.id, event.choices[0].id);
    for (let g = 0; g < 4 && st().scene; g++) { try { store.sceneSkip(); } catch { try { store.sceneAbandon(); } catch { break; } } }
    if (st().night) { for (let h = 0; h < 14 && st().night.hour < 12; h++) store.advanceElectionNight(); night = st().night; store.concludeElectionNight(); continue; }
    store.advance(1);
  }
  return { campaign: st().campaign, night };
}

const report = [];
for (const type of ['comunale', 'provinciale', 'regionale', 'politiche', 'europee']) {
  let ctx = null;
  for (const seed of [`coal-${type}-a`, `coal-${type}-b`, `coal-${type}-c`]) { ctx = await setup(type, seed); if (ctx) break; }
  if (!ctx) { problems.push(`${type}: nessuna elezione aperta raggiungibile per la prova`); continue; }
  const registered = ctx.store.registerCoalition(ctx.election.id);
  check(registered.approved, `${type}: la coalizione con forze compatibili è approvata (${registered.reasons?.join('; ')})`);
  // save and reload between the registration and the campaign
  ctx.store.loadGame(JSON.parse(ctx.store.exportSave()));
  try { start(ctx, type); } catch (error) { problems.push(`${type}: la campagna non parte (${error.message})`); continue; }
  const campaign = ctx.st().campaign;
  const allied = alliedIn(campaign, ctx.partners);
  check(allied.length === ctx.partners.length, `${type}: i partner registrati si presentano insieme al giocatore (alleati ${allied.length}/${ctx.partners.length})`);
  if (['politiche', 'europee'].includes(type)) {
    const coalitions = L.buildCoalitions(ctx.st().world, { election: ctx.election });
    const mine = coalitions.filter(item => item.partyIds.includes(ctx.me));
    check(mine.length === 1 && ctx.partners.every(id => mine[0].partyIds.includes(id)), `${type}: nella composizione del voto nazionale il giocatore e i partner sono nella stessa coalizione`);
    const twice = coalitions.flatMap(item => item.partyIds).filter((id, index, all) => all.indexOf(id) !== index);
    check(!twice.length, `${type}: nessun partito in due coalizioni (${twice.join(', ')})`);
  }
  const { campaign: done, night } = finish(ctx);
  check(done?.status === 'finished', `${type}: la campagna arriva al risultato`);
  const row = done?.result?.groups?.find(item => (item.memberCandidateIds ?? [item.candidateId]).includes(done.playerCandidateId));
  const partnerCandidates = (done?.candidates ?? []).filter(item => ctx.partners.includes(item.partyId)).map(item => item.id);
  const national = ['politiche', 'europee'].includes(type);
  if (!national) check(row && partnerCandidates.every(id => row.memberCandidateIds?.includes(id)), `${type}: nel risultato i partner sono nella riga della coalizione del giocatore`);
  else check(partnerCandidates.every(id => (done.candidates.find(item => item.id === id)?.coalitionLeaderId ?? null) === done.playerCandidateId), `${type}: nel risultato i partner restano nella coalizione del giocatore`);
  if (night) {
    const nightRow = (night.groups ?? night.rows ?? []).find(item => (item.memberCandidateIds ?? [item.candidateId]).includes(done.playerCandidateId));
    check(!nightRow || !national ? !nightRow || partnerCandidates.every(id => (nightRow.memberCandidateIds ?? []).includes(id)) : true, `${type}: la Notte Elettorale usa la composizione effettiva della coalizione`);
  }
  ctx.store.loadGame(JSON.parse(ctx.store.exportSave()));
  check(ctx.st().campaign?.result?.playerShare === done?.result?.playerShare, `${type}: dopo il ricaricamento il risultato è lo stesso`);
  report.push(`${type}: ${allied.length} partner alleati, quota ${done?.result?.playerShare}%${night ? ', notte vista' : ''}`);
}

// ---- the negative cases, on a comunale vote ----
// not registered
{
  const ctx = await setupAny('comunale', 'coal-neg-a');
  if (ctx) { start(ctx, 'comunale'); check(alliedIn(ctx.st().campaign, ctx.partners).length === 0, 'Non registrata: nessun partner diventa alleato per il solo fatto dell’alleanza.'); }
  else problems.push('Non registrata: nessuna comunale aperta per la prova');
}
// refused (cohesion too low)
{
  const ctx = await setupAny('comunale', 'coal-neg-b', { cohesion: 20 });
  if (ctx) {
    const out = ctx.store.registerCoalition(ctx.election.id);
    check(!out.approved && /coesione/.test(out.reasons.join(' ')), `Respinta: con la coesione bassa la registrazione è respinta con il motivo (${out.reasons.join('; ')}).`);
    start(ctx, 'comunale'); check(alliedIn(ctx.st().campaign, ctx.partners).length === 0, 'Respinta: i partner non si presentano insieme.');
  }
}
// registered for another vote
{
  const ctx = await setupAny('comunale', 'coal-neg-c');
  if (ctx) {
    const saved = JSON.parse(ctx.store.exportSave());
    const own = saved.world.alliances.find(item => item.id === ctx.allianceId);
    own.coalitions = [{ electionId: 'elezione-di-un-altro-voto', type: 'comunale', label: 'un altro voto', electionDate: '2020-01-01', status: 'approvata', approvedAt: '2019-12-01', reasons: [], members: [...own.partyIds] }];
    ctx.store.loadGame(saved);
    start(ctx, 'comunale'); check(alliedIn(ctx.st().campaign, ctx.partners).length === 0, 'Registrata per un altro voto: non vale per questo.');
  }
}
// members changed after the approval (a force joins: a merger of accords works the same way); approved again, the new member stands too
{
  const ctx = await setupAny('comunale', 'coal-neg-d');
  if (ctx) {
    ctx.store.registerCoalition(ctx.election.id);
    const extra = ctx.pool.find(item => !ctx.partners.includes(item.id))?.id;
    const saved = JSON.parse(ctx.store.exportSave());
    for (const alliance of saved.world.alliances) if (alliance.status === 'active' && alliance.id !== ctx.allianceId && alliance.partyIds.includes(extra)) { alliance.partyIds = alliance.partyIds.filter(id => id !== extra); if (alliance.partyIds.length < 2) alliance.status = 'ended'; }
    saved.world.alliances.find(item => item.id === ctx.allianceId).partyIds.push(extra);
    ctx.store.loadGame(saved);
    const before = JSON.parse(ctx.store.exportSave());
    start(ctx, 'comunale');
    check(alliedIn(ctx.st().campaign, [...ctx.partners, extra]).length === 0, 'Componenti cambiati: l’approvazione data ad altri componenti non vale finché non è rinnovata.');
    ctx.store.loadGame(before);
    const again = ctx.store.registerCoalition(ctx.election.id);
    if (again.approved) { start(ctx, 'comunale'); check(alliedIn(ctx.st().campaign, [...ctx.partners, extra]).length === 3, 'Riapprovata con il nuovo componente: si presentano tutti e tre insieme.'); }
  }
}
// the window: after the filing of the lists nothing is registered
{
  const ctx = await setupAny('comunale', 'coal-neg-e');
  if (ctx) {
    const saved = JSON.parse(ctx.store.exportSave());
    saved.clock.currentDate = ctx.election.windowClosesAt.replace(/\d\d$/, day => String(Math.min(28, Number(day) + 1)).padStart(2, '0'));
    ctx.store.loadGame(saved);
    let blocked = null; try { ctx.store.registerCoalition(ctx.election.id); } catch (error) { blocked = error.message; }
    check(/chiuse|deposito/.test(blocked ?? ''), `Finestra scaduta: la registrazione è rifiutata con il motivo (${blocked}).`);
  }
}
// a force that refused is not a member: it is never allied with the player
{
  const ctx = await setupAny('comunale', 'coal-neg-f', { partners: 1 });
  if (ctx) {
    const refused = ctx.pool.find(item => !ctx.partners.includes(item.id))?.id;
    ctx.store.registerCoalition(ctx.election.id);
    start(ctx, 'comunale');
    const campaign = ctx.st().campaign;
    check(!campaign.candidates.some(item => item.partyId === refused && item.status === 'allied'), 'Un partito che non ha aderito non è nella coalizione.');
    check(alliedIn(campaign, ctx.partners).length === 1, 'Il partito che ha aderito sì.');
  }
}
if (problems.length) { console.error(`Coalizioni alle elezioni — problemi:\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`Coalizioni alle elezioni verificate: ${report.join(' · ')}; non registrata, respinta, registrata per un altro voto, componenti cambiati (e riapprovata), finestra scaduta e partito che non aderisce si comportano come da regole.`);
