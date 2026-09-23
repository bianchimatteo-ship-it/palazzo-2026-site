// Deep simulation: society, territories, finances, party organisation, real parliamentarians,
// real laws and a complete multi-year career where every system talks to the others.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

const KEY = 'palazzo-2026.career.v1';
const localStore = new Map();
globalThis.localStorage = { getItem: key => localStore.get(key) ?? null, setItem: (key, value) => localStore.set(key, String(value)), removeItem: key => localStore.delete(key) };
const realDir = new URL('../src/data/real/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name + '.json', realDir), 'utf8'));
// Fingerprint of every real dataset: the simulation must never write to them.
const fingerprint = async () => {
  const hash = createHash('sha256');
  for (const name of (await readdir(realDir)).filter(file => file.endsWith('.json')).sort()) hash.update(name).update(await readFile(new URL(name, realDir)));
  return hash.digest('hex');
};
const before = await fingerprint();
const [groups, politicians, offices, laws, parties] = await Promise.all(['parliamentary-groups', 'politicians', 'offices', 'laws', 'parties'].map(read));
const politiciansSnapshot = JSON.stringify(politicians);

const society = await import('../src/core/society-engine.js');
const finance = await import('../src/core/finance-engine.js');
const organization = await import('../src/core/organization-engine.js');
const contacts = await import('../src/core/contacts-engine.js');

// 1. Società: stabile nel tempo, territori diversi, problemi che nascono dalla situazione.
let issuesSeen = 0;
for (const seed of ['alfa', 'beta', 'gamma']) {
  let s = society.createSociety({ seedText: seed, date: '2026-09-28', homeRegion: 'Toscana' });
  assert.equal(s.source, 'simulation');
  assert.equal(Object.keys(s.regions).length, 20);
  for (let week = 2; week <= 156; week++) {
    const out = society.advanceSociety(s, { date: '2026-09-28', week, government: null, notoriety: 30 });
    s = out.society;
    issuesSeen += out.derived.length;
    assert.ok(s.satisfaction > 15 && s.satisfaction < 90, `Soddisfazione fuori scala (${seed}, settimana ${week})`);
    assert.ok(s.economy.growth >= -3 && s.economy.growth <= 4 && s.publicFinance.headroom >= 0 && s.publicFinance.headroom <= 100);
  }
  assert.ok(s.executive.measures.length > 0, 'Senza governo agisce l’esecutivo di scenario.');
  assert.ok(s.history.length > 50);
}
assert.ok(issuesSeen > 0, 'Nel corso degli anni emergono problemi territoriali.');
const base = society.createSociety({ seedText: 'leggi', date: '2026-09-28' });
const applied = society.applyLawToSociety(base, { category: 'Sanità', title: 'Prova', date: '2026-09-28', week: 1 });
assert.ok(applied.summary.covered && applied.society.publicFinance.headroom < base.publicFinance.headroom, 'Una legge consuma margine di bilancio.');
assert.ok(applied.society.effects.length === 20, 'Gli effetti arrivano in tutte le regioni, gradualmente.');
const gains = Object.fromEntries(applied.society.effects.map(effect => [effect.region, effect.perWeek]));
const [weakest, strongest] = [...Object.values(base.regions)].sort((a, b) => a.indicators.sanita - b.indicators.sanita).filter((_, index, list) => index === 0 || index === list.length - 1);
assert.ok(gains[weakest.name] > gains[strongest.name], 'Le regioni più indietro guadagnano di più dalla stessa legge.');
let media = society.mediaEvent(base, { outletId: 'tv-nazionale', tone: -1, headline: 'Titolo di prova', date: '2026-09-28', week: 1 });
assert.ok(media.media.sentiment < 0 && media.media.coverage[0].outlet === 'Telegiornali nazionali');

// 2. Finanze: registro, budget, debito, bilancio annuale.
const game = { week: { index: 1 }, resources: { funds: 300 } };
finance.book(game, -500, 'comunicazione', 'Prova');
assert.equal(game.resources.funds, 0);
assert.equal(game.finance.debt, 200, 'Una spesa oltre la cassa diventa debito.');
game.finance = finance.setBudgetLevel(game.finance, 'personale', 2);
assert.throws(() => finance.setBudgetLevel(game.finance, 'personale', 5), /Livello/);
game.resources.funds = 5000;
const week1 = finance.settleFinanceWeek(game, { week: 1, date: '2026-12-28', incomes: [{ category: 'base', amount: 250 }] });
assert.equal(week1.effects.staffDays, 1);
assert.ok(game.finance.debt < 200, 'Con la cassa in attivo il debito si rimborsa.');
finance.settleFinanceWeek(game, { week: 2, date: '2027-01-04', incomes: [] });
assert.equal(game.finance.annual.at(-1).year, '2026', 'Il cambio d’anno chiude il bilancio annuale.');
assert.ok(['solida', 'calo', 'rischio', 'crisi'].includes(finance.financeOutlook(game).status));

// 3. Organizzazione del partito.
let counter = 7;
const rand = () => { counter = (Math.imul(counter, 1664525) + 1013904223) >>> 0; return counter / 4294967296; };
const founded = organization.createOrganization({ rand, founder: true, region: 'Puglia', week: 1, date: '2026-09-28' });
assert.equal(founded.sections.length, 1);
organization.applyOrgEffects(founded, { section: true, week: 2 }, [], 'Basilicata');
assert.equal(founded.sections.length, 2, 'Si apre una nuova sezione territoriale.');
const big = organization.createOrganization({ rand, founder: false, region: 'Lazio', share: 12, week: 1, date: '2026-09-28' });
const startTreasury = big.treasury.balance;
let congress = false;
for (let week = 2; week <= 60; week++) {
  const out = organization.advanceOrganization(big, { rand, week, date: '2027-01-04', pollShare: 12, currents: [{ id: 'a', label: 'A', strength: 40 }, { id: 'b', label: 'B', strength: 36 }] });
  congress ||= out.events.some(event => event.type === 'congress');
}
assert.ok(congress, 'Il congresso ordinario arriva nel calendario del partito.');
assert.ok(big.treasury.balance > 0 && big.treasury.balance < startTreasury * 4, 'La tesoreria resta credibile.');
assert.ok(big.membersHistory.length > 20);

// 4. Parlamentari reali: nomi esatti, gruppi e incarichi verificati.
const picked = contacts.selectContacts({ politicians, groups, offices, region: 'Toscana', chamber: 'camera', groupId: 'cam-xix-04', seedText: 'prova' });
assert.ok(picked.length >= 4);
for (const { person, reason } of picked) {
  const real = politicians.find(item => item.id === person.id);
  assert.ok(real && real.fullName === person.fullName && real.groupId === person.groupId && real.chamber === person.chamber, 'Identità copiata senza modifiche.');
  assert.equal(person.source, 'real');
  if (reason === 'territorio') assert.ok(/^toscana/i.test(real.circoscription));
  if (person.verifiedRole) assert.ok(offices.some(office => office.politicianId === person.id && office.title === person.verifiedRole && office.verified === true), 'Solo incarichi documentati.');
}
const synced = contacts.syncContacts([], picked, { rand });
assert.ok(synced.every(item => item.source === 'simulation' && item.relation >= 0 && item.relation <= 100));

// 5. Leggi reali: collezione verificata e area di gioco solo come interpretazione.
assert.ok(laws.length > 300 && laws.every(law => law.source === 'real' && law.verified === true && law.sourceUrl.startsWith('https://www.senato.it/')));
assert.ok(laws.filter(law => society.realLawArea(law)).length > laws.length / 3, 'Buona parte degli atti ha un’area di gioco.');

// 6. Carriera completa di più anni: legge → parlamento → governo → finanze → territori → cittadini → sondaggi → partito → carriera → elezioni.
const { store } = await import('../src/core/store.js?simulation=1');
const draft = { firstName: 'Marta', lastName: 'Neri', birthDate: '1985-02-11', gender: 'donna', region: 'Toscana', municipality: 'Siena', previousProfession: 'Architetta', initialLevel: 'deputato', partyMode: 'existing', partyId: 'partito-demo', parliamentStartMode: 'real-context', parliamentaryGroupId: 'cam-xix-04', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } };
store.createCareer(draft, [], groups);
store.initializeParliament(groups);
store.syncRealContacts({ politicians, groups, offices });
const seats = {};
for (const person of politicians.filter(item => item.chamber === 'camera' && !item.termEnd)) { const region = Object.keys(store.getState().society.regions).find(name => person.circoscription?.toLowerCase().startsWith(name.toLowerCase().slice(0, 6))); if (region) seats[region] = (seats[region] ?? 0) + 1; }
store.calibrateSociety(seats);
let state = store.getState();
assert.equal(state.society.weightSource, 'camera', 'Le medie nazionali usano i seggi reali della Camera come pesi.');
assert.equal(state.society.regions.Lombardia.weight, seats.Lombardia);
assert.equal(state.society.source, 'simulation');
assert.equal(state.game.legislature.label, 'XIX legislatura');
assert.ok(state.game.contacts.length >= 4 && state.game.party.org && state.game.finance);
store.setBudget('comunicazione', 1);
store.setBudget('territorio', 1);
const notorietyStart = state.dataset.statistics.find(item => item.subjectId === state.career.playerId && item.metric === 'notoriety').value;

// A real contact met in person becomes closer; a simulated amendment to a real law keeps the real identity.
const contactId = state.game.contacts[0].person.id;
const relationBefore = state.game.contacts[0].relation;
store.performWeeklyActivity('incontro-parlamentare', contactId);
assert.ok(store.getState().game.contacts.find(item => item.person.id === contactId).relation !== relationBefore);
const realLaw = laws.find(item => item.outcome === 'legge' && society.realLawArea(item));
const law = store.proposeLaw({ title: 'Modifiche a una legge reale', category: society.realLawArea(realLaw), summary: 'Proposta simulata che interviene su un atto reale.', realReference: { id: realLaw.id, label: `legge n. ${realLaw.lawNumber}`, officialTitle: realLaw.officialTitle, lawNumber: realLaw.lawNumber, lawDate: realLaw.lawDate, status: realLaw.status, sourceUrl: realLaw.sourceUrl, source: 'real', verified: true } });
assert.equal(law.source, 'simulation');
assert.equal(law.realReference.officialTitle, realLaw.officialTitle);

// The law goes through both chambers; groups are courted until it passes.
const steps = { proposal: 'present', commission: 'complete-commission', amendments: 'force-vote', 'other-chamber': 'transmit', 'final-vote': 'final-vote' };
for (let guard = 0; guard < 40; guard++) {
  const current = store.getState().parliament.laws.find(item => item.id === law.id);
  if (['approved', 'rejected', 'lapsed'].includes(current.stage)) break;
  try {
    if (['amendments', 'final-vote'].includes(current.stage) && store.getState().parliament.resources.politicalCapital >= 4) {
      const target = store.getState().parliament.chambers[current.currentChamber].groups.find(group => group.groupId !== store.getState().parliament.player.groupId && !current.negotiatedGroupIds.includes(group.groupId));
      if (target) store.negotiateLaw(law.id, target.groupId);
    }
    store.advanceLaw(law.id, steps[current.stage]);
  } catch { store.advance(7); }
}
state = store.getState();
const finalLaw = state.parliament.laws.find(item => item.id === law.id);
if (finalLaw.stage === 'approved') {
  const impact = state.society.lawsApplied.find(item => item.lawId === law.id);
  assert.ok(impact, 'La legge approvata arriva nella società.');
  assert.ok(state.society.effects.some(effect => effect.cause === law.title), 'Gli effetti si distribuiscono nel tempo sui territori.');
  assert.ok(state.world.events.some(event => event.title.includes(law.title)), 'La cronaca registra la legge.');
  assert.ok(state.society.media.coverage.some(item => item.headline.includes(law.title)), 'I media ne parlano.');
}

// Three years of weekly play: decisions, activities, elections.
const seen = { situation: new Set(), congress: false, selection: false, promiseKept: 0, campaign: false, legislature: false };
for (let week = 0; week < 156; week++) {
  state = store.getState();
  if (state.game.status === 'ended') break;
  for (const item of [...state.game.inbox]) {
    if (item.kind === 'situazione') seen.situation.add(item.templateId);
    if (item.templateId === 'congresso') seen.congress = true;
    if (item.templateId === 'selezione-candidati') seen.selection = true;
    const choice = item.templateId === 'crisi-territoriale' ? 'promessa' : item.templateId === 'selezione-candidati' ? 'accordo' : item.choices.find(entry => !entry.cost?.ap)?.id ?? item.defaultChoice;
    try { store.resolveAgendaItem(item.id, choice); } catch { /* not affordable this week */ }
  }
  for (const id of ['ascolto', 'tesseramento', 'social']) { try { store.performWeeklyActivity(id); } catch { /* time or money */ } }
  state = store.getState();
  const open = state.game.elections.find(item => item.status === 'open' && item.type === 'politiche');
  if (open && state.campaign?.status !== 'active' && !seen.campaign) {
    store.startCampaign({ electionType: 'politiche', role: 'deputato', objective: 'seat' }, parties, { politicians, groups });
    const campaign = store.getState().campaign;
    assert.ok('moodBonus' in campaign.preparation && campaign.context.participation > 0, 'Umore e partecipazione dei cittadini entrano nella campagna.');
    campaign.nomination.status = 'approved';
    campaign.candidacy.listPosition = campaign.nomination.listPosition = 1;
    for (const area of campaign.territories) { const ids = Object.keys(area.supportByCandidate); area.supportByCandidate = Object.fromEntries(ids.map(id => [id, id === campaign.playerCandidateId ? 60 : 40 / (ids.length - 1)])); }
    campaign.day = campaign.totalDays - 1;
    store.advance(1);
    seen.campaign = true;
    store.clearCampaign();
  }
  store.advance(7);
  state = store.getState();
  seen.promiseKept += (state.game.promises ?? []).filter(item => item.status !== 'open').length ? 1 : 0;
  if (state.game.legislature.number === 20) seen.legislature = true;
}
state = store.getState();
assert.ok(seen.selection, 'Il partito apre la selezione dei candidati prima delle elezioni.');
assert.ok(seen.congress, 'Il congresso ordinario si tiene durante la carriera.');
assert.ok(seen.campaign && seen.legislature, 'Le politiche si svolgono e si apre una nuova legislatura simulata.');
assert.equal(state.game.legislature.reference, 'simulation');
assert.ok(state.game.finance.history.length >= 50 && state.game.finance.annual.length >= 2, 'Il bilancio annuale si chiude ogni anno.');
assert.ok(state.game.finance.ledger.some(entry => entry.category === 'comunicazione') && state.game.finance.ledger.some(entry => entry.category === 'territorio'), 'Le spese finiscono nel registro per categoria.');
assert.ok(state.society.history.length >= 100, 'La società evolve anche senza il giocatore.');
assert.ok(state.world.polls.at(-1).mood, 'I sondaggi leggono l’umore dei cittadini.');
assert.ok(state.world.polls.at(-1).government || state.world.polls.at(-1).executive, 'Il gradimento dell’esecutivo è misurato.');
assert.ok(state.society.media.coverage.length > 5, 'Le attività producono copertura mediatica.');
assert.ok(state.game.party.org.membersHistory.length > 40 && state.game.party.org.treasury.annual.length >= 2, 'Il partito ha iscritti e bilanci nel tempo.');
assert.ok(seen.situation.size >= 1, 'Arrivano eventi derivati dalla situazione.');
assert.ok(seen.situation.has('crisi-territoriale'), 'I problemi del territorio arrivano in agenda.');
assert.ok((state.game.promises ?? []).filter(item => item.dueWeek < state.game.week.index).every(item => item.status !== 'open'), 'Le promesse scadute vengono verificate.');
const notorietyEnd = state.dataset.statistics.find(item => item.subjectId === state.career.playerId && item.metric === 'notoriety').value;
assert.ok(notorietyEnd !== notorietyStart);
for (const metric of ['popularity', 'reputation', 'notoriety', 'influence']) {
  const value = state.dataset.statistics.find(item => item.subjectId === state.career.playerId && item.metric === metric)?.value;
  if (value !== undefined) assert.ok(value >= 0 && value <= 100, `${metric} resta tra 0 e 100`);
}

// 7. Salvataggi: persistenza completa e migrazione di un salvataggio precedente.
const saved = JSON.parse(localStore.get(KEY));
assert.ok(saved.society && saved.game.finance && saved.game.party.org && saved.game.contacts.length);
const { store: reloaded } = await import('../src/core/store.js?simulation=2');
assert.equal(reloaded.getState().society.week, state.society.week);
assert.equal(reloaded.getState().game.finance.history.length, state.game.finance.history.length);
const legacy = JSON.parse(localStore.get(KEY));
delete legacy.society; delete legacy.game.finance; delete legacy.game.contacts; delete legacy.game.promises; delete legacy.game.legislature; delete legacy.game.party.org;
localStore.set(KEY, JSON.stringify(legacy));
const { store: migrated } = await import('../src/core/store.js?simulation=3');
const upgraded = migrated.getState();
assert.ok(upgraded.society && upgraded.game.finance && upgraded.game.party.org && Array.isArray(upgraded.game.contacts) && upgraded.game.legislature);
assert.equal(upgraded.game.week.index, state.game.week.index, 'La carriera salvata prosegue dal punto in cui era.');
migrated.advance(7);
assert.equal(migrated.getState().game.week.index, state.game.week.index + 1);

// 8. Separazione real / simulation: i dataset reali non cambiano.
assert.equal(JSON.stringify(politicians), politiciansSnapshot);
assert.equal(await fingerprint(), before, 'Nessun file del dataset reale è stato modificato.');
console.log(`Simulazione verificata: società e territori stabili su 3 anni (${issuesSeen} problemi emersi), leggi con effetti territoriali differenziati, finanze con budget, debito e bilanci annuali, partito con iscritti, sezioni, congresso, selezione dei candidati e tesoreria, ${picked.length} parlamentari reali con identità verificata, ${laws.length} atti reali, carriera completa di ${state.game.week.index} settimane con elezioni politiche e nuova legislatura, salvataggi e migrazione, dataset reali intatti.`);
