// Every victory makes the office playable, on the real engine: comunali → Sindaco / Consigliere → Comune; regionali →
// Presidente / Consigliere → Regione; politiche → Deputato / Senatore → Parlamento (→ Governo); europee → Eurodeputato →
// Parlamento europeo. The vote is forced (support, list position, preferences) to walk each path; then the office, the
// level of the career, the institution and its actions, roles and powers, the events after the vote and the way to the
// place where the mandate is played are checked. A majority that breaks up dissolves the council: the term ends, the
// office shown moves to the one still open and the early vote is in the calendar.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer, playWeek } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { playerRoles } = await module('src/core/roles.js');
const { careerLevelLabel } = await module('src/data/regions.js');
const { mandatePlace } = await module('src/ui/election-report.js');
const { renderInstitutions } = await module('src/ui/local-mode.js');
const FDI = 'party-registro-p1-2014-04-ir';

const give = store => { const s = store.getState(); s.game.week.ap = Math.max(s.game.week.ap, 6); s.game.resources.funds = Math.max(s.game.resources.funds, 50000); s.game.resources.politicalCapital = 80; if (s.game.party) s.game.party.support = 90; };
// The vote goes the player's way: first on the list, strong preferences, most of the votes everywhere.
function forceWin(store) {
  const c = store.getState().campaign;
  c.nomination.status = 'approved';
  c.nomination.internalSupport = 10;
  c.candidacy.listPosition = 1;
  c.candidateStats = { ...c.candidateStats, notoriety: 98, reputation: 98, popularity: 98 };
  c.activityUses = { ...c.activityUses, door_to_door: 12 };
  for (const area of c.territories) { const ids = Object.keys(area.supportByCandidate); area.supportByCandidate = Object.fromEntries(ids.map(id => [id, id === c.playerCandidateId ? 60 : 40 / Math.max(1, ids.length - 1)])); }
  c.day = c.totalDays - 1;
  store.advance(1);
}
async function win({ seed, region, type, role = null, partyId }) {
  const run = await startCareer({ seed, level: 'comunale', region, ...(partyId ? { partyId } : {}) });
  const { store, db } = run;
  give(store);
  const from = store.getState().clock.currentDate;
  const open = store.fastForwardToElection(type);
  assert.ok(open, `${seed}: finestra delle candidature ${type} raggiunta (fermo al ${store.getState().clock.currentDate})`);
  give(store);
  store.startCampaign({ electionType: type, ...(role ? { role } : {}), objective: 'seat' }, db.parties, { politicians: db.politicians, groups: db.parliamentaryGroups });
  forceWin(store);
  if (store.getState().campaign?.status === 'active') forceWin(store); // the runoff
  const s = store.getState();
  assert.equal(s.campaign?.status, 'finished', `${seed}: la campagna si chiude con il voto`);
  assert.ok(s.career.lastElectionResult?.personalMandate, `${seed}: mandato conquistato (${s.career.lastElectionResult?.outcomeLabel})`);
  const player = s.dataset.politicians.find(item => item.id === s.career.playerId);
  const offices = s.dataset.offices.filter(item => item.politicianId === player.id && !item.endDate);
  return { run, store, s, player, offices, office: s.dataset.offices.find(item => item.id === player.roleId), from };
}
const active = (s, kind) => (s.local?.institutions ?? []).find(item => item.kind === kind && item.status === 'active');
const hasRole = (s, pattern) => playerRoles(s).roles.some(([, label]) => pattern.test(label));
const power = (s, prefix) => playerRoles(s).powers.find(item => item.label.startsWith(prefix));
const inbox = s => s.game.inbox.map(item => item.templateId);
const lines = [];

// ---------- 1. comunali → Sindaco → Comune (guidi la giunta) ----------
{
  const { store, s, office, run } = await win({ seed: 'mandato-sindaco', region: 'Toscana', type: 'comunale', role: 'sindaco' });
  assert.equal(office?.title, 'Sindaco');
  assert.equal(s.career.currentLevel, 'comunale');
  const inst = active(s, 'comune');
  assert.ok(inst && inst.playerRole === 'sindaco' && inst.executive.leader === 'player', 'Il sindaco guida la giunta del suo comune');
  assert.ok(hasRole(s, /^Sindaco di /), 'Tra i ruoli: Sindaco');
  assert.ok(power(s, 'Giunta, assessori').enabled && power(s, 'Proposte, voti').enabled, 'Il sindaco nomina gli assessori, decide i tributi e vota in consiglio');
  assert.deepEqual(mandatePlace(s, s.career.lastElectionReport), { nav: 'territori', label: 'Vai al consiglio comunale' });
  assert.ok(inbox(s).includes('giunta-composizione'), 'Dopo il voto: la scelta della giunta in agenda');
  assert.match(renderInstitutions(s), /data-local-tax/, 'La pagina Territori mostra il comune con le leve del sindaco');
  const member = inst.executive.members[0];
  const other = inst.groups.find(group => group.side === 'maggioranza' && group.id !== member.groupId);
  if (other) store.reshuffleLocalGiunta(inst.id, member.portfolio, other.id);
  store.setLocalTaxLevel(inst.id, 'bassa');
  store.proposeLocalAct(inst.id, 'casa');
  for (let week = 0; week < 10; week++) playWeek(run);
  const after = store.getState().local.institutions.find(item => item.id === inst.id);
  assert.equal(after.budget.localTax, 'bassa');
  assert.ok([...after.acts, ...after.archive].some(act => act.kind === 'player'), 'La proposta del sindaco è in consiglio');
  assert.ok([...after.acts, ...after.archive].filter(act => ['approvato', 'respinto'].includes(act.stage)).length >= 1, 'Il consiglio vota');
  lines.push(`Sindaco: ${inst.name}, ${inst.groups.length} gruppi, ${after.archive.length + after.acts.length} atti in 10 settimane`);
}

// ---------- 2. comunali → Consigliere → Comune (maggioranza o opposizione) ----------
{
  const { store, s, office } = await win({ seed: 'mandato-consigliere', region: 'Toscana', type: 'comunale', role: 'consigliere' });
  assert.equal(office?.title, 'Consigliere comunale');
  const inst = active(s, 'comune');
  assert.ok(inst && inst.playerRole === 'consigliere' && inst.executive.leader !== 'player');
  assert.ok(inbox(s).includes(inst.playerSide === 'maggioranza' ? 'giunta-offerta' : 'capogruppo-opposizione'), 'Dopo il voto: assessorato o guida dell’opposizione');
  assert.ok(power(s, 'Proposte, voti').enabled && !power(s, 'Giunta, assessori').enabled, 'Il consigliere propone e vota, non nomina la giunta');
  assert.throws(() => store.setLocalTaxLevel(inst.id, 'alta'), /Solo chi guida/);
  store.questionLocalExecutive(inst.id);
  store.proposeLocalAct(inst.id, 'trasporti');
  assert.ok(store.getState().local.institutions.find(item => item.id === inst.id).history.some(item => item.type === 'interrogazione'));
  lines.push(`Consigliere comunale: ${inst.playerSide}`);
}

// ---------- 3. regionali → Presidente → Regione (il voto toscano è a più di quattro anni: ci si arriva) ----------
{
  const { s, office, from } = await win({ seed: 'mandato-presidente', region: 'Toscana', type: 'regionale', role: 'presidente' });
  const weeks = Math.round((Date.parse(s.clock.currentDate) - Date.parse(from)) / 604800000);
  assert.ok(weeks > 160, `La finestra delle regionali toscane è lontana (${weeks} settimane)`);
  assert.equal(office?.title, 'Presidente di Regione');
  assert.equal(s.career.currentLevel, 'regionale');
  assert.equal(careerLevelLabel(s.career.currentLevel), 'Carriera regionale');
  const inst = active(s, 'regione');
  assert.ok(inst && inst.playerRole === 'presidente' && inst.executive.leader === 'player');
  assert.ok(hasRole(s, /^Presidente della Regione Toscana$/));
  assert.deepEqual(mandatePlace(s, s.career.lastElectionReport), { nav: 'territori', label: 'Vai al consiglio regionale' });
  lines.push(`Presidente di Regione dopo ${weeks} settimane di avanzamento`);
}

// ---------- 4. regionali → Consigliere → Regione ----------
{
  const { s, office } = await win({ seed: 'mandato-regione', region: 'Lombardia', type: 'regionale', role: 'consigliere' });
  assert.equal(office?.title, 'Consigliere regionale');
  assert.equal(s.career.currentLevel, 'regionale');
  const inst = active(s, 'regione');
  assert.ok(inst && inst.playerRole === 'consigliere');
  assert.ok(hasRole(s, /^Consigliere regionale$/));
  lines.push(`Consigliere regionale: ${inst.playerSide}`);
}

// ---------- 5. europee → Eurodeputato → Parlamento europeo ----------
{
  const { store, s, office, run } = await win({ seed: 'mandato-europa', region: 'Campania', type: 'europee' });
  assert.equal(office?.title, 'Deputato al Parlamento europeo');
  assert.equal(s.career.currentLevel, 'europeo');
  assert.equal(careerLevelLabel(s.career.currentLevel), 'Carriera europea');
  const inst = active(s, 'europa');
  assert.ok(inst && inst.playerRole === 'eurodeputato' && inst.groups.some(group => group.id === inst.playerGroupId), 'Siedi in un gruppo del Parlamento europeo');
  assert.ok(hasRole(s, /^Deputato al Parlamento europeo$/) && power(s, 'Proposte, voti').enabled);
  assert.deepEqual(mandatePlace(s, s.career.lastElectionReport), { nav: 'territori', label: 'Vai al Parlamento europeo' });
  store.proposeLocalAct(inst.id, 'europa');
  for (let week = 0; week < 6; week++) playWeek(run);
  const after = store.getState().local.institutions.find(item => item.id === inst.id);
  assert.ok(after.acts.length + after.archive.length >= 2, 'A Strasburgo si vota');
  // The comune of the start (Salerno votes in 2031) is still open: the career keeps both.
  assert.ok(s.dataset.offices.some(item => item.politicianId === s.career.playerId && !item.endDate && item.level === 'comunale'));
  lines.push(`Eurodeputato: gruppo ${inst.playerGroupId}, ${after.acts.length + after.archive.length} atti`);
}

// ---------- 6. politiche → Deputato / Senatore → Parlamento (→ Governo) ----------
for (const [role, chamber, region] of [['deputato', 'camera', 'Lombardia'], ['senatore', 'senato', 'Campania']]) {
  const { s, office } = await win({ seed: `mandato-${role}`, region, type: 'politiche', role, partyId: FDI });
  assert.equal(office?.title, role === 'deputato' ? 'Deputato' : 'Senatore');
  assert.equal(s.career.currentLevel, role);
  assert.equal(s.parliament?.player?.chamber, chamber, `Il seggio è in ${chamber}`);
  assert.ok(s.parliament.player.groupId, 'Siedi nel gruppo del tuo partito');
  assert.ok(hasRole(s, role === 'deputato' ? /^Deputato$/ : /^Senatore$/) && power(s, 'Leggi con contenuto').enabled);
  assert.deepEqual(mandatePlace(s, s.career.lastElectionReport), { nav: 'parlamento', label: 'Vai al Parlamento' });
  // The Government: the talks about the cabinet concern the player when the own party is in the winning coalition.
  const vote = s.national?.lastPolitiche;
  const winners = vote?.winner ? (vote.coalitions.find(item => item.id === vote.winner)?.partyIds ?? [vote.winner]) : [];
  if (winners.includes(FDI)) assert.ok(s.career.lastElectionReport.consequences.events.includes('consultazioni-governo'), 'Con la coalizione vincente si apre la squadra di governo');
  lines.push(`${office.title}: ${s.parliament.player.groupId}${winners.includes(FDI) ? ', consultazioni per il governo' : ''}`);
}

// ---------- 7. the majority breaks up: sfiducia, scioglimento, early vote; the office shown follows ----------
{
  const { store, s, office, run } = await win({ seed: 'mandato-sfiducia', region: 'Lombardia', type: 'regionale', role: 'presidente' });
  assert.equal(office?.title, 'Presidente di Regione');
  const inst = active(s, 'regione');
  // The coalition splits: most of its councillors cross the floor, the allies leave the majority.
  const lead = inst.groups.find(group => group.id === inst.executive.groupId);
  const moved = lead.seats - Math.floor(inst.seats * 0.3);
  inst.groups = [...inst.groups.map(group => group.id === lead.id ? { ...group, seats: group.seats - moved } : { ...group, side: 'opposizione' }), { ...lead, id: 'transfughi', label: 'Transfughi', side: 'opposizione', seats: moved }];
  let dissolved = null;
  for (let week = 0; week < 16 && !dissolved; week++) {
    playWeek(run);
    dissolved = store.getState().local.institutions.find(item => item.id === inst.id && item.status !== 'active') ?? null;
  }
  const after = store.getState();
  assert.ok(dissolved, 'Senza maggioranza la sfiducia scioglie il consiglio');
  assert.ok(after.dataset.offices.find(item => item.id === office.id).endDate, 'Il mandato da presidente si chiude');
  const shown = after.dataset.offices.find(item => item.id === after.dataset.politicians.find(item => item.id === after.career.playerId).roleId);
  assert.ok(shown && !shown.endDate && shown.level === 'comunale', `La carica mostrata passa a quella ancora aperta (${shown?.title})`);
  assert.equal(after.career.currentLevel, 'comunale');
  const early = after.game.elections.find(item => item.type === 'regionale' && item.status === 'upcoming');
  assert.ok(early?.early, 'Regionali anticipate in calendario');
  lines.push(`Sfiducia: consiglio sciolto, voto anticipato il ${early.electionDate}, carica mostrata ${shown.title}`);
}

console.log(`Vittorie giocabili verificate sul motore reale: comunali (sindaco, consigliere), regionali (presidente, consigliere, anche a più di quattro anni), europee, politiche (Camera e Senato) → carica, livello della carriera, istituzione con le sue azioni, ruoli e poteri, eventi del dopo voto e accesso diretto al luogo del mandato; maggioranza rotta → sfiducia, scioglimento, voto anticipato e carica aggiornata.\n  ${lines.join('\n  ')}`);
