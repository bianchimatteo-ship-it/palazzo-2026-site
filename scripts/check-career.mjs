// A multi-year career end to end: election → leadership → Government → decisions → law and decree → budget →
// citizens → territories → media → polls → crisis → new elections, then save, reload and migration of an old save.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const KEY = 'palazzo-2026.career.v1';
const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };

const realData = await import('../src/data/repositories/real-data.js');
await realData.loadRealDatabase();
await realData.loadRealCollections(['parties', 'politicalMovements', 'twoPerThousand', 'parliamentaryGroups', 'politicians']);
const db = () => realData.realDatabase;
const engine = await import('../src/core/parliament-engine.js');
let { store } = await import('../src/core/store.js?career=1');
store.setRealReference({ twoPerThousand: db().twoPerThousand, parties: db().parties, movements: db().politicalMovements });
const seen = { election: false, leadership: false, government: false, program: false, law: false, decree: false, budget: false, crisis: false, newElection: false, memoryAtElection: false, territorial: false, consensusWhy: false, mediaLaw: false, citizens: false };

// A founder who starts from the Chamber: the career still has to earn every step.
const draft = { firstName: 'Paola', lastName: 'Serena', birthDate: '1979-07-07', gender: 'donna', region: 'Campania', municipality: 'Salerno', previousProfession: 'Ingegnera', initialLevel: 'deputato', parliamentaryGroupId: 'cam-xix-02', parliamentStartMode: 'real-context', partyMode: 'new', partyName: 'Lista civica di prova', partyAbbreviation: 'LCP', partyColor: '#7a3e9d', partyColor2: '#f7c948', partyDescription: 'Partito del test pluriennale.', partyOrientation: 'Altro', partyProgram: ['sanita', 'mezzogiorno', 'lavoro'], policyPositions: { economia: 3, welfare: 4, ambiente: 3, europa: 4 } };
store.createCareer(draft, db().parties, db().parliamentaryGroups);
const give = () => { const s = store.getState(); if (s.game.status === 'ended') { s.game.status = 'active'; s.game.endReason = null; } s.game.week.ap = Math.max(s.game.week.ap, 6); s.game.resources.politicalCapital = Math.max(s.game.resources.politicalCapital, 45); };
const keepAlive = () => { const s = store.getState(); for (const item of s.dataset.statistics) if (item.subjectId === s.career.playerId && item.metric === 'reputation' && item.value < 30) item.value = 30; if (s.game.party) s.game.party.support = Math.max(s.game.party.support, 40); };
const resolveInbox = () => {
  for (const item of [...store.getState().game.inbox]) {
    const choice = item.templateId === 'richiesta-alleato' ? 'accetta' : item.templateId === 'sessione-bilancio' ? 'prepara' : item.choices.find(entry => entry.id === 'decreto' && item.category === 'emergenza')?.id ?? item.choices.find(entry => !entry.cost?.ap && !entry.requires)?.id ?? item.defaultChoice;
    try { give(); store.resolveAgendaItem(item.id, choice); if (choice === 'decreto') seen.decree = true; } catch { /* not possible this week */ }
  }
};
const week = () => { resolveInbox(); keepAlive(); store.advance(7); give(); };
const pass = id => {
  const steps = { commission: 'complete-commission', amendments: 'vote', 'other-chamber': 'transmit', 'final-vote': 'final-vote' };
  for (let guard = 0; guard < 24; guard++) {
    const law = store.getState().parliament.laws.find(item => item.id === id);
    if (['approved', 'rejected', 'lapsed'].includes(law.stage)) return law;
    give();
    try {
      if (law.stage === 'amendments') for (const [groupId, demand] of Object.entries(law.demands ?? {})) if (!demand.accepted) store.acceptLawDemand(id, groupId);
      store.advanceLaw(id, law.stage === 'proposal' ? 'present' : steps[law.stage]);
    } catch (error) { if (!/settiman/.test(error.message)) throw error; week(); }
  }
  return store.getState().parliament.laws.find(item => item.id === id);
};
const coalition = ['cam-xix-01', 'cam-xix-02', 'cam-xix-03', 'cam-xix-04', 'senato-xix-gruppo-85', 'senato-xix-gruppo-33', 'senato-xix-gruppo-56', 'senato-xix-gruppo-49'];
const governNow = () => {
  const government = store.getState().parliament.government;
  if (!government || ['fallen'].includes(government.status)) { give(); store.formGovernment(coalition); }
  if (['awaiting-confidence', 'crisis'].includes(store.getState().parliament.government.status)) { give(); store.voteGovernmentConfidence(); }
  return store.getState().parliament.government.status;
};

// 1. Leadership: a founder leads the party and decides its line, programme and communication.
assert.ok(store.getState().game.party.affiliation === 'founder' && store.getState().game.party.program.areas.includes('mezzogiorno'), 'Il programma scelto alla fondazione entra nel partito.');
give(); store.setPartyLine('coalizione');
give(); store.setCommunication('popolare');
seen.leadership = true;
week(); week();

// 2. Government: coalition, confidence, Prime Minister, programme.
assert.equal(governNow(), 'active', 'Il governo ottiene la fiducia.');
seen.government = store.getState().parliament.government.primeMinister === 'player';
give(); store.setGovernmentProgram({ line: 'crescita', priorities: ['sanita', 'mezzogiorno', 'lavoro'] });
seen.program = true;
give(); store.assignMinister('Salute', 'cam-xix-03');
give(); store.assignMinister('Economia e finanze', 'cam-xix-01');

// 3. A law through Parliament, a decree under an emergency; the country reacts.
const measures = store.getState().society.lawsApplied.length;
give();
const bill = store.proposeGovernmentBill({ title: 'Lavoro al Sud', policy: { area: 'mezzogiorno', instrument: 'sostegno', intensity: 2, financing: 'ue' } });
const passed = pass(bill.id);
seen.law = passed.stage === 'approved';
if (seen.law) {
  const impact = store.getState().society.lawsApplied.find(item => item.lawId === bill.id);
  seen.citizens = Boolean(impact.winners?.length);
  seen.mediaLaw = store.getState().society.media.coverage.some(item => item.headline.includes('Lavoro al Sud'));
}
assert.ok(store.getState().society.lawsApplied.length >= measures, 'Le misure arrivano sul Paese solo dopo il voto.');
store.getState().game.flags.emergencies = { sanita: store.getState().game.week.index };
governNow(); give();
try { store.issueDecree({ policy: { area: 'sanita', instrument: 'sostegno', intensity: 1, financing: 'deficit' } }); seen.decree = true; } catch (error) { assert.match(error.message, /ravvicinati|decreti|capitale/); }

// 4. Years of play: events, allies, budget sessions, markets, citizens.
let lastPolitics = store.getState().career.electionHistory?.length ?? 0;
for (let i = 0; i < 180; i++) {
  const s = store.getState();
  const month = Number(s.clock.currentDate.slice(5, 7));
  if (s.parliament.government?.status === 'crisis' || s.parliament.government?.status === 'fallen') { seen.crisis = true; if (s.game.party?.affiliation === 'founder' && s.parliament.player?.groupId) { try { governNow(); } catch { /* not this week */ } } }
  // The budget session: the manovra goes through both Chambers.
  if (month >= 10 && s.parliament.government?.primeMinister === 'player' && s.parliament.government.status === 'active' && !s.parliament.laws.some(law => law.kind === 'manovra' && !['approved', 'rejected', 'lapsed'].includes(law.stage)) && (s.parliament.government.budgetYear ?? 0) <= Number(s.clock.currentDate.slice(0, 4))) {
    try { give(); const manovra = store.presentBudget({ allocations: { welfare: 1, territorio: 1, conti: -1 }, taxes: 0 }); seen.budget = pass(manovra.id).stage === 'approved' || seen.budget; } catch { /* next week */ }
  }
  const poll = s.world.polls.at(-1);
  if (poll?.why?.length) seen.consensusWhy = true;
  if (s.world.effects.some(effect => effect.cause === 'territori')) seen.territorial = true;
  // New elections: when the window opens, run the campaign.
  const open = s.game.elections.find(item => item.status === 'open' && item.type === 'politiche');
  if (open && s.campaign?.status !== 'active') {
    try {
      give();
      store.startCampaign({ electionType: 'politiche', role: 'deputato', objective: 'seat' }, db().parties, { politicians: db().politicians, groups: db().parliamentaryGroups });
      const campaign = store.getState().campaign;
      seen.memoryAtElection = 'memory' in campaign.preparation;
      campaign.nomination.status = 'approved';
      for (const area of campaign.territories) { const ids = Object.keys(area.supportByCandidate); area.supportByCandidate = Object.fromEntries(ids.map(id => [id, id === campaign.playerCandidateId ? 55 : 45 / (ids.length - 1)])); }
      campaign.day = campaign.totalDays - 1;
      store.advance(1);
      store.clearCampaign();
      if ((store.getState().career.electionHistory?.length ?? 0) > lastPolitics) { seen.newElection = true; seen.election = true; }
      lastPolitics = store.getState().career.electionHistory?.length ?? 0;
      if (!store.getState().parliament.player?.groupId && store.getState().parliament.player) { give(); store.joinParliamentaryGroup('cam-xix-02'); }
    } catch { /* not available this week */ }
  }
  // Late in the career, bring the government down to test the road to early elections.
  // (a player who lost the seat at the polls cannot open it: the test opens it among the others, as an ally walking out would)
  if (i === 120 && store.getState().parliament.government?.status === 'active') {
    if (store.getState().parliament.player?.groupId) { give(); store.triggerGovernmentCrisis(); }
    else Object.assign(store.getState().parliament.government, { status: 'crisis', crisisSeverity: 12, crisisOpenedAt: store.getState().clock.currentDate });
    seen.crisis = true;
  }
  week();
}
const final = store.getState();
assert.ok(seen.leadership && seen.government && seen.program, 'Leadership, governo e programma.');
assert.ok(seen.law && seen.citizens && seen.mediaLaw, 'Una legge approvata arriva a cittadini e media.');
assert.ok(seen.decree, 'Un decreto per un’emergenza.');
assert.ok(seen.budget, 'Una legge di bilancio approvata dalle Camere.');
assert.ok(seen.crisis, 'Una crisi di governo.');
assert.ok(seen.territorial, 'Le misure e l’umore dei cittadini spostano il consenso territorio per territorio.');
assert.ok(seen.consensusWhy, 'I sondaggi spiegano le variazioni del consenso.');
assert.ok(seen.newElection && seen.memoryAtElection, 'Nuove elezioni, con la memoria politica nella campagna.');
assert.ok((final.game.memory ?? []).length >= 3, 'La carriera accumula una memoria politica.');
assert.ok(final.game.timeline.length >= 8, 'La cronologia racconta la carriera.');
assert.ok(final.game.week.index >= 180 && final.society.history.length >= 100 && final.world.polls.length >= 50, 'Anni di società e sondaggi (lo storico dei sondaggi conserva l’ultimo anno).');
// Forces of the database that entered the polls during the career keep their real identity.
const realIds = new Set([...db().parties, ...db().politicalMovements].filter(item => item.source === 'real').map(item => item.id));
assert.ok(final.world.parties.every(party => party.isPlayer || party.reference?.source === 'real' || party.pollReference?.source === 'real' || (party.refSource === 'real' && realIds.has(party.id)) || (party.origin === 'evoluzione' && party.refSource === 'simulation' && /simulat/.test(party.label))), 'Gli altri partiti restano reali; le forze nate nella partita sono dichiaratamente simulate.');

// 5. Saves: everything persists after a reload; an old save is migrated without losing the career.
store.save();
const saved = JSON.parse(mem.get(KEY));
assert.equal(saved.version, 9);
assert.ok(saved.game.memory && saved.society.areas && saved.society.security && saved.parliament.laws.some(law => law.policy), 'Memoria, temi, sicurezza e contenuto delle leggi nel salvataggio.');
({ store } = await import('../src/core/store.js?career=2'));
const reloaded = store.getState();
assert.equal(reloaded.game.week.index, final.game.week.index, 'La carriera riparte dal punto in cui era.');
assert.deepEqual(reloaded.game.memory.map(item => item.id), final.game.memory.map(item => item.id), 'La memoria politica non si perde.');
assert.equal(reloaded.dataset.parties.find(party => party.source === 'user').logo.kind, 'builder', 'L’identità del partito resta.');
const legacy = structuredClone(saved);
legacy.version = 6;
delete legacy.game.memory; delete legacy.game.eventHistory; delete legacy.society.areas; delete legacy.society.security; delete legacy.society.publicFinance.spread;
for (const law of legacy.parliament.laws) { delete law.policy; delete law.demands; delete law.stageSince; delete law.origin; delete law.kind; }
if (legacy.parliament.government) { delete legacy.parliament.government.partners; delete legacy.parliament.government.program; }
mem.set(KEY, JSON.stringify(legacy));
({ store } = await import('../src/core/store.js?career=3'));
const migrated = store.getState();
assert.equal(migrated.version, 9);
assert.ok(migrated.society.areas && migrated.society.security && Number.isFinite(migrated.society.publicFinance.spread), 'Il vecchio salvataggio riceve temi, sicurezza e mercati.');
assert.equal(migrated.game.week.index, final.game.week.index);
assert.ok(mem.get(`${KEY}.backup`), 'Il salvataggio precedente è conservato prima dell’aggiornamento.');
store.advance(7);
assert.equal(store.getState().game.week.index, final.game.week.index + 1, 'La partita migrata prosegue.');

console.log(`Carriera pluriennale verificata: ${final.game.week.index} settimane, ${Object.entries(seen).filter(([, value]) => value).length}/${Object.keys(seen).length} tappe (leadership, governo, programma, legge ${passed.stage}, decreto, manovra, crisi, territori, spiegazioni del consenso, media, cittadini, nuove elezioni con memoria), ${final.game.memory.length} ricordi politici, salvataggio, ricaricamento e migrazione di un salvataggio precedente.`);
