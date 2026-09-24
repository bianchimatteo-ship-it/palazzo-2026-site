// Government, policies and difficulty: the Prime Minister acts through Government, majority and Parliament;
// every measure has a cost, a cover, winners and losers, territories that gain more than others.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };

const society = await import('../src/core/society-engine.js');
const engine = await import('../src/core/parliament-engine.js');
const rules = await import('../src/data/simulation/policy-rules.js');
const { store } = await import('../src/core/store.js');
const realData = await import('../src/data/repositories/real-data.js');
await realData.loadRealDatabase();
await realData.loadRealCollections(['parties', 'politicalMovements', 'twoPerThousand', 'parliamentaryGroups']);
const db = () => realData.realDatabase;
store.setRealReference({ twoPerThousand: db().twoPerThousand, parties: db().parties, movements: db().politicalMovements });

// ---------- 1. every policy area is a real lever: indicator, problem, instruments, consequences ----------
const base = society.createSociety({ seedText: 'governo', date: '2026-09-28' });
assert.ok(rules.POLICY_AREAS.length >= 30, 'Almeno trenta temi politici.');
for (const area of rules.POLICY_AREAS) {
  assert.ok(area.national && area.problem && area.portfolio && Object.keys(area.instruments).length === 4, `${area.label}: indicatore, problema, ministero e strumenti`);
  assert.ok(Number.isFinite(society.areaValue(base, area.id)), `${area.label}: indicatore misurabile`);
  for (const instrument of Object.keys(rules.INSTRUMENT_KINDS)) {
    const p = society.projectMeasure(base, { area: area.id, instrument, intensity: 2, financing: 'deficit' });
    assert.ok(p.cost > 0 && p.billions > 0, `${area.label}/${instrument}: ha un costo`);
    assert.ok(p.winners.length + p.losers.length > 0, `${area.label}/${instrument}: qualcuno guadagna o perde`);
    assert.ok(p.areaAfter !== p.areaBefore || Object.values(p.regionDeltas).some(value => value !== 0), `${area.label}/${instrument}: cambia qualcosa nel Paese`);
  }
}
// The same money works differently depending on the instrument and the scale.
const invest = society.projectMeasure(base, { area: 'sanita', instrument: 'investimento', intensity: 2 });
const rulesOnly = society.projectMeasure(base, { area: 'sanita', instrument: 'regole', intensity: 2 });
assert.ok(invest.cost > rulesOnly.cost * 4 && invest.phaseIn < 16, 'Un investimento costa molto più di una norma.');
assert.ok(society.projectMeasure(base, { area: 'sanita', intensity: 3 }).cost > society.projectMeasure(base, { area: 'sanita', intensity: 1 }).cost * 2, 'La portata cambia il conto.');

// ---------- 2. budget: every policy must be paid for ----------
const byDeficit = society.projectMeasure(base, { area: 'infrastrutture', intensity: 3, financing: 'deficit' });
const byTaxes = society.projectMeasure(base, { area: 'infrastrutture', intensity: 3, financing: 'consumi' });
const byCuts = society.projectMeasure(base, { area: 'infrastrutture', intensity: 3, financing: 'tagli', cutArea: 'cultura' });
assert.ok(byDeficit.deficitAfter > base.economy.deficit && byDeficit.spreadAfter > base.publicFinance.spread, 'In deficit salgono deficit e spread.');
assert.ok(byTaxes.deficitAfter < byDeficit.deficitAfter && byTaxes.losers.some(item => item.id === 'fragili' && /accise|iva/i.test(item.reason)), 'Con accise e IVA pagano soprattutto i redditi bassi, e si sa perché.');
assert.ok(byCuts.headroomAfter > byDeficit.headroomAfter, 'I tagli consumano meno margine del deficit.');
const cut = society.applyMeasure(base, { area: 'infrastrutture', intensity: 3, financing: 'tagli', cutArea: 'cultura' }, { title: 'Grandi opere', week: 1 }).society;
assert.ok(cut.effects.some(effect => effect.area === 'cultura' && effect.perWeek < 0), 'Chi viene tagliato perde davvero.');
// Money is not infinite: without margin, a measure is uncovered and weaker.
const broke = { ...base, publicFinance: { ...base.publicFinance, headroom: 2 } };
const uncovered = society.projectMeasure(broke, { area: 'sanita', intensity: 3, financing: 'deficit' });
assert.ok(!uncovered.covered && uncovered.strength < society.projectMeasure(base, { area: 'sanita', intensity: 3 }).strength, 'Senza margine la misura è scoperta e rende meno.');
// Spending in deficit week after week brings Brussels and the markets.
let reckless = base;
for (let week = 2; week < 40; week++) {
  if (week % 3 === 0) reckless = society.applyMeasure(reckless, { area: 'fisco', intensity: 3, financing: 'deficit' }, { title: `Taglio tasse ${week}`, week }).society;
  reckless = society.advanceSociety(reckless, { date: '2026-10-01', week, government: { status: 'active', stability: 50 } }).society;
}
assert.ok(reckless.economy.deficit > rules.EU_DEFICIT_LIMIT && ['richiamo', 'procedura'].includes(reckless.publicFinance.euStatus), 'Il deficit oltre il 3% porta richiami e procedura europea.');
assert.ok(reckless.publicFinance.spread > base.publicFinance.spread + 40, 'I mercati puniscono i conti fuori controllo.');
// The annual budget moves the accounts and the groups of citizens.
const plan = { allocations: { welfare: 1, sicurezza: 1, conti: -1 }, taxes: 1 };
const budget = society.budgetImpact(base, plan);
assert.ok(budget.winners.includes('fragili') && budget.losers.includes('imprese'), 'La manovra ha vincitori e perdenti.');
const withBudget = society.applyBudgetPlan(base, plan, { date: '2026-12-10', week: 12 });
assert.equal(withBudget.publicFinance.allocations.welfare, 1);
assert.ok(society.provisionalBudget(base).publicFinance.spread > base.publicFinance.spread, 'L’esercizio provvisorio innervosisce i mercati.');

// ---------- 3. territories and citizens ----------
const south = society.projectMeasure(base, { area: 'lavoro', intensity: 2, target: 'mezzogiorno' });
const southRegions = new Set([...rules.MACRO_AREAS.sud.regions, ...rules.MACRO_AREAS.isole.regions]);
assert.ok(south.topRegions.every(item => southRegions.has(item.name)), 'Una misura per il Mezzogiorno arriva al Sud e nelle Isole.');
assert.ok(south.bottomRegions.every(item => !southRegions.has(item.name)), 'Il resto del Paese resta indietro.');
const national = society.projectMeasure(base, { area: 'sanita', intensity: 2 });
const gains = Object.values(national.regionDeltas);
assert.ok(Math.max(...gains) - Math.min(...gains) > 0.3, 'La stessa legge nazionale produce effetti diversi da regione a regione.');
const toFamilies = society.projectMeasure(base, { area: 'famiglia', instrument: 'sostegno', segment: 'famiglie' });
assert.ok(toFamilies.winners[0].id === 'famiglie' && toFamilies.losers.some(item => /escluso/.test(item.reason)), 'Un bonus mirato favorisce una categoria e fa sentire esclusi gli altri.');

// ---------- 4. security: different tools, different timescales and side effects ----------
const tough = society.projectMeasure(base, { area: 'sicurezza', instrument: 'regole', intensity: 2 });
const police = society.projectMeasure(base, { area: 'sicurezza', instrument: 'investimento', intensity: 2 });
assert.ok(tough.perceivedAfter > base.security.perceived && tough.cost < police.cost / 3, 'Pene più severe rassicurano e costano poco…');
assert.ok(tough.losers.some(item => item.id === 'giovani') && society.applyMeasure(base, { area: 'sicurezza', instrument: 'regole' }, { title: 'Pene', week: 1 }).society.effects.some(effect => effect.area === 'giustizia' && effect.perWeek < 0), '…ma dividono e intasano la giustizia.');
assert.ok(police.crimeAfter < base.security.crime && police.cost > tough.cost, 'Più agenti riducono i reati ma costano molto.');
let secured = society.applyMeasure(base, { area: 'sicurezza', instrument: 'investimento', intensity: 3 }, { title: 'Assunzioni', week: 1 }).society;
for (let week = 2; week < 26; week++) secured = society.advanceSociety(secured, { date: '2026-10-01', week }).society;
assert.ok(secured.security.capacity > base.security.capacity + 5, 'Le assunzioni aumentano la capacità operativa nel tempo.');

// ---------- 5. the Prime Minister: powers through Government, majority and Parliament ----------
const founder = { firstName: 'Carla', lastName: 'Riva', birthDate: '1980-03-03', gender: 'donna', region: 'Puglia', municipality: 'Bari', previousProfession: 'Avvocata', initialLevel: 'deputato', parliamentaryGroupId: 'cam-xix-01', parliamentStartMode: 'real-context', partyMode: 'new', partyName: 'Movimento civico di prova', partyAbbreviation: 'MCP', partyColor: '#2a6f97', partyColor2: '#f4d35e', partyDescription: 'Partito creato per il test.', partyOrientation: 'Altro', partyProgram: ['sanita', 'lavoro'], policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } };
store.createCareer(founder, db().parties, db().parliamentaryGroups);
const give = () => { const s = store.getState(); s.game.week.ap = 6; s.game.resources.politicalCapital = 60; };
const week = (n = 1) => { for (let i = 0; i < n; i++) store.advance(7); give(); };
assert.throws(() => store.setGovernmentProgram({ line: 'crescita', priorities: ['sanita', 'lavoro'] }), /Presidente del Consiglio/, 'Senza governo non si governa.');
give();
store.formGovernment(['cam-xix-01', 'cam-xix-03', 'cam-xix-04', 'senato-xix-gruppo-85', 'senato-xix-gruppo-33', 'senato-xix-gruppo-56']);
give();
store.voteGovernmentConfidence();
let s = store.getState();
assert.equal(s.parliament.government.primeMinister, 'player', 'Con la fiducia sei Presidente del Consiglio.');
assert.ok(Object.keys(s.parliament.government.partners).length >= 3, 'Gli alleati hanno una loro soddisfazione.');
give();
const partnersBefore = structuredClone(s.parliament.government.partners);
store.setGovernmentProgram({ line: 'equita', priorities: ['welfare', 'sanita', 'lavoro', 'casa'] });
s = store.getState();
assert.ok(Object.entries(s.parliament.government.partners).some(([id, item]) => item.satisfaction !== partnersBefore[id].satisfaction), 'Gli alleati reagiscono al programma.');
assert.throws(() => { give(); store.setGovernmentProgram({ line: 'rigore', priorities: ['finanze', 'fisco'] }); }, /da poco/, 'Il programma non si cambia ogni settimana.');
// Ministers: appointments, reshuffles and the resentment they cause.
give(); store.assignMinister('Salute', 'cam-xix-03');
give(); store.assignMinister('Economia e finanze', 'cam-xix-04');
const loser = store.getState().parliament.government.partners['cam-xix-03'].satisfaction;
give(); store.reshuffleMinister('Salute', 'cam-xix-04');
s = store.getState();
assert.ok(engine.activeMinisters(s.parliament.government).find(item => item.portfolio === 'Salute').groupId === 'cam-xix-04' && s.parliament.government.partners['cam-xix-03'].satisfaction < loser, 'Il rimpasto sposta un ministero e scontenta chi lo perde.');
// A government bill: no unilateral approval, weeks of work, groups asking for changes.
give();
const measuresBefore = store.getState().society.lawsApplied.length;
let bill = store.proposeGovernmentBill({ title: 'Piano per la medicina territoriale', policy: { area: 'sanita', instrument: 'riforma', intensity: 2, financing: 'evasione' } });
assert.equal(store.getState().society.lawsApplied.length, measuresBefore, 'Il disegno di legge non produce effetti finché il Parlamento non lo approva.');
give(); store.advanceLaw(bill.id, 'present');
assert.throws(() => { give(); store.advanceLaw(bill.id, 'complete-commission'); }, /settiman/, 'La commissione ha i suoi tempi.');
week(2); store.advanceLaw(bill.id, 'complete-commission');
const opposition = s.parliament.chambers.camera.groups.find(group => !engine.governingGroupIds(store.getState().parliament).has(group.groupId) && group.groupId !== s.parliament.player.groupId);
give(); store.negotiateLaw(bill.id, opposition.groupId);
bill = store.getState().parliament.laws.find(item => item.id === bill.id);
assert.ok(bill.demands[opposition.groupId]?.label, 'Il gruppo chiede una modifica in cambio dei voti.');
store.acceptLawDemand(bill.id, opposition.groupId);
give(); store.amendLawPolicy(bill.id, { intensity: 1 });
bill = store.getState().parliament.laws.find(item => item.id === bill.id);
assert.equal(bill.policy.intensity, 1, 'Il contenuto simulato della proposta cambia davvero.');
const pass = id => {
  const steps = { commission: 'complete-commission', amendments: 'vote', 'other-chamber': 'transmit', 'final-vote': 'final-vote' };
  for (let guard = 0; guard < 20; guard++) {
    const law = store.getState().parliament.laws.find(item => item.id === id);
    if (['approved', 'rejected', 'lapsed'].includes(law.stage)) return law;
    give();
    try { store.advanceLaw(id, law.stage === 'proposal' ? 'present' : steps[law.stage]); } catch (error) { if (!/settiman/.test(error.message)) throw error; week(); }
  }
  return store.getState().parliament.laws.find(item => item.id === id);
};
bill = pass(bill.id);
assert.ok(['approved', 'rejected'].includes(bill.stage), 'Il testo arriva al voto delle Camere.');
if (bill.stage === 'approved') assert.ok(store.getState().society.lawsApplied.some(item => item.lawId === bill.id && item.winners), 'Approvata, la legge arriva al Paese con vincitori e perdenti.');
// Decree-laws: only with an emergency; void if not converted.
give();
assert.throws(() => store.issueDecree({ policy: { area: 'cultura', instrument: 'sostegno' } }), /necessità e urgenza/, 'Niente decreti senza emergenza.');
store.getState().game.flags.emergencies = { energia: store.getState().game.week.index };
give();
const decree = store.issueDecree({ policy: { area: 'energia', instrument: 'sostegno', intensity: 2, financing: 'deficit' } });
s = store.getState();
assert.ok(decree.inForce && decree.deadline && s.society.lawsApplied.some(item => item.lawId === decree.id), 'Il decreto è in vigore subito, con una scadenza per la conversione.');
give();
assert.throws(() => store.issueDecree({ policy: { area: 'energia', instrument: 'regole' } }), /ravvicinati|decreti in attesa/, 'I decreti non si possono moltiplicare.');
const stabilityBefore = store.getState().parliament.government.stability;
week(10);
s = store.getState();
const lapsed = s.parliament.laws.find(item => item.id === decree.id);
if (lapsed.stage === 'lapsed') {
  assert.ok(s.society.lawsApplied.find(item => item.lawId === decree.id)?.revoked, 'Il decreto non convertito decade e i suoi effetti si fermano.');
  assert.ok((s.game.memory ?? []).some(item => item.kind === 'decreto-decaduto'), 'La decadenza resta nella memoria politica.');
}
assert.ok(s.parliament.government.status !== 'active' || s.parliament.government.stability !== stabilityBefore || lapsed.stage === 'lapsed', 'Il tempo passa anche per il governo.');
// The question of confidence: if the vote fails, the Government falls.
{
  const parliament = structuredClone(store.getState().parliament);
  if (['active', 'crisis'].includes(parliament.government.status)) {
    parliament.government.status = 'active';
    parliament.government.coalitionGroupIds = ['cam-xix-11', 'senato-xix-gruppo-9'];
    parliament.government.supportingGroupIds = [];
    const law = { id: 'legge-fiducia', title: 'Riforma della giustizia', category: 'Giustizia', summary: 'Prova di fiducia', stage: 'final-vote', status: 'final-vote', introducedAt: '2026-01-01', updatedAt: '2026-01-01', stageSince: '2026-01-01', firstChamber: 'camera', currentChamber: 'camera', negotiatedGroupIds: [], amendments: [], compromiseLevel: 0, forcedVote: false, demands: {}, origin: 'governo', kind: 'ddl', policy: { area: 'giustizia' }, votes: [], confidence: true, source: 'simulation' };
    parliament.laws.push(law);
    const result = engine.advanceLaw(parliament, law.id, 'final-vote', store.getState().clock.currentDate);
    assert.equal(result.law.stage, 'rejected');
    assert.equal(result.parliament.government.status, 'fallen', 'Persa la fiducia su un testo, il governo cade.');
  }
}
// Allies ignored for too long leave the majority.
{
  const parliament = structuredClone(store.getState().parliament);
  parliament.government.status = 'active';
  {
    const [groupId] = Object.keys(parliament.government.partners);
    parliament.government.partners[groupId] = { ...parliament.government.partners[groupId], satisfaction: 18, demand: { type: 'misura', area: 'casa', label: 'un provvedimento sulla casa', deadline: '2020-01-01', since: '2019-12-01' } };
    const next = engine.advanceGovernmentWeek(parliament, store.getState().clock.currentDate, 0.5, () => 0.9);
    assert.ok(!next.government.coalitionGroupIds.includes(groupId) && !next.government.supportingGroupIds.includes(groupId), 'L’alleato ignorato esce dalla maggioranza.');
    assert.equal(next.government.status, 'crisis', 'E il governo deve tornare a chiedere la fiducia.');
  }
}
// A government in crisis must win back the confidence before governing again.
const ensureGovernment = () => {
  const government = store.getState().parliament.government;
  if (government.status === 'crisis' || government.status === 'awaiting-confidence') { give(); store.voteGovernmentConfidence(); }
  if (store.getState().parliament.government.status === 'fallen') { give(); store.formGovernment(['cam-xix-01', 'cam-xix-03', 'cam-xix-04', 'cam-xix-02', 'senato-xix-gruppo-85', 'senato-xix-gruppo-33', 'senato-xix-gruppo-56', 'senato-xix-gruppo-49']); give(); store.voteGovernmentConfidence(); }
  return store.getState().parliament.government.status;
};
console.log(`  governo prima della manovra: ${store.getState().parliament.government.status} → ${ensureGovernment()}`);
// The budget session: the manovra goes to Parliament; without it, provisional management.
assert.equal(store.getState().parliament.government.status, 'active', 'Il governo riottiene la fiducia.');
{
  give();
  const manovra = store.presentBudget({ allocations: { welfare: 1, conti: -1 }, taxes: 0 });
  assert.equal(manovra.kind, 'manovra');
  assert.throws(() => { give(); store.presentBudget({}); }, /già all’esame/);
  const approved = pass(manovra.id);
  if (approved.stage === 'approved') assert.equal(store.getState().society.publicFinance.allocations.welfare, 1, 'La manovra approvata cambia le priorità di spesa.');
}

// ---------- 6. difficulty: nothing is guaranteed ----------
assert.ok(rules.STAGE_WEEKS.commission >= 2, 'Le leggi richiedono settimane, non clic.');
assert.throws(() => store.issueDecree({ policy: { area: 'turismo' } }), /Presidente del Consiglio|urgenza|decreti|ravvicinati|giorni|capitale/);
const poor = store.getState();
poor.game.resources.politicalCapital = 1;
assert.throws(() => store.majoritySummit(), /capitale|Presidente/, 'Ogni mossa del governo costa capitale politico.');

console.log(`  rami: ddl ${bill.stage}, decreto ${lapsed.stage}, governo ${store.getState().parliament.government.status}, manovra ${store.getState().parliament.laws.find(item => item.kind === 'manovra')?.stage ?? 'non presentata'}`);
console.log(`Governo e politiche verificati: ${rules.POLICY_AREAS.length} temi con indicatori, problemi, ministeri e 4 strumenti ciascuno; costi, coperture (deficit, tasse, tagli, fondi UE), deficit, spread e procedura europea; manovra e esercizio provvisorio; effetti diversi per territorio e gruppo di cittadini; sicurezza con strumenti e tempi diversi; Presidente del Consiglio con programma, alleati, rimpasti, disegni di legge (esito: ${bill.stage}), decreti con urgenza e decadenza, fiducia su un testo, alleati che escono dalla maggioranza.`);
