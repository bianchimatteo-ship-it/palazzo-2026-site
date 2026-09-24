import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const KEY = 'palazzo-2026.career.v1';
const localStore = new Map();
globalThis.localStorage = { getItem: key => localStore.get(key) ?? null, setItem: (key, value) => localStore.set(key, String(value)), removeItem: key => localStore.delete(key) };
const read = async name => JSON.parse(await readFile(new URL('../src/data/real/' + name + '.json', import.meta.url), 'utf8'));
const groups = await read('parliamentary-groups');
const parties = await read('parties');
const realSnapshot = JSON.stringify(parties);
const realParty = parties.find(item => item.id === 'party-futuro-nazionale');
let imports = 0;
const load = async () => (await import('../src/core/store.js?gameplay=' + (++imports))).store;
// Rewrites the saved career, then reloads the store as a browser refresh would.
const reload = async mutate => { const saved = JSON.parse(localStore.get(KEY)); mutate(saved); localStore.set(KEY, JSON.stringify(saved)); return load(); };
const stat = (state, metric) => state.dataset.statistics.find(item => item.subjectId === state.career.playerId && item.metric === metric)?.value;
const setStat = (saved, metric, value) => { saved.dataset.statistics.find(item => item.subjectId === saved.career.playerId && item.metric === metric).value = value; };
const draft = (level, extra = {}) => ({
  firstName: 'Marta', lastName: 'Neri', birthDate: '1985-02-11', gender: 'donna', region: 'Toscana', municipality: 'Siena', previousProfession: 'Architetta',
  initialLevel: level, partyMode: 'existing', partyId: 'party-registro-p1-2024-71-ir', parliamentStartMode: 'real-context',
  parliamentaryGroupId: level === 'deputato' ? 'cam-xix-04' : level === 'senatore' ? 'senato-xix-gruppo-56' : '',
  policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 }, ...extra
});
const finishCampaign = (store, share) => {
  const campaign = store.getState().campaign;
  campaign.nomination.status = 'approved';
  campaign.candidacy.listPosition = campaign.nomination.listPosition = 1;
  for (const area of campaign.territories) {
    const ids = Object.keys(area.supportByCandidate);
    area.supportByCandidate = Object.fromEntries(ids.map(id => [id, id === campaign.playerCandidateId ? share : (100 - share) / (ids.length - 1)]));
  }
  campaign.day = campaign.totalDays - 1;
  store.advance(1);
};

let store = await load();

// 1. Inizio carriera: politico, livello, territorio, partito, statistiche e prima settimana.
const volt = parties.find(item => item.id === 'party-registro-p1-2024-71-ir');
store.createCareer(draft('comunale'), [realParty, volt], groups);
let state = store.getState();
assert.equal(state.version, 6);
assert.equal(state.game.source, 'simulation');
assert.equal(state.game.week.index, 1);
assert.equal(state.game.week.ap, 6);
assert.equal(state.game.party.partyId, 'party-registro-p1-2024-71-ir');
assert.equal(state.game.party.rankTitle, 'Iscritto');
assert.equal(state.game.party.currents.length, 3);
assert.ok(state.game.inbox.length >= 2, 'La prima settimana propone appuntamenti.');
assert.ok(state.game.elections.find(item => item.type === 'comunale').label.includes('Siena'));
assert.ok(state.game.relations.some(item => item.id === 'leadership') && state.game.relations.some(item => item.id === 'rival'));

// 2. Attività: costi, effetti e limite di tempo.
const funds = state.game.resources.funds;
const popularity = stat(state, 'popularity');
store.performWeeklyActivity('ascolto');
state = store.getState();
assert.equal(state.game.week.ap, 5);
assert.equal(state.game.resources.funds, funds - 150);
assert.ok(stat(state, 'popularity') !== popularity);
assert.ok(state.game.log[0].title.includes('Giro di ascolto'));
store.performWeeklyActivity('riunione');
store.performWeeklyActivity('incontro', 'civic');
store.performWeeklyActivity('associazioni');
assert.throws(() => store.performWeeklyActivity('progetto'), /giorni/);
assert.throws(() => store.performWeeklyActivity('aula'), /seggio/);
assert.throws(() => store.startCampaign({ electionType: 'comunale', role: 'sindaco' }, []), /candidature/);

// 3. Decisioni: una scelta esplicita e una lasciata al default a fine settimana.
const firstItem = state.game.inbox[0];
const cheapChoice = firstItem.choices.find(choice => !choice.cost?.ap) ?? firstItem.choices.at(-1);
store.resolveAgendaItem(firstItem.id, cheapChoice.id);
assert.ok(!store.getState().game.inbox.some(item => item.id === firstItem.id));
const pendingBefore = store.getState().game.inbox.length;
store.advance(7);
state = store.getState();
assert.equal(state.game.week.index, 2);
assert.equal(state.game.week.ap, 6);
assert.ok(state.game.lastReport.lines[0].startsWith('Entrate della settimana'));
if (pendingBefore) assert.ok(state.game.log.some(entry => entry.title.includes('senza decisione')), 'Le decisioni ignorate producono comunque conseguenze.');
assert.ok(state.game.inbox.length >= 2, 'Ogni settimana genera nuovi appuntamenti.');

// 4. Partito: correnti, sostegno e incarico interno conquistato costruendo i rapporti.
store.alignPartyCurrent(state.game.party.leaderCurrentId);
for (let week = 0; week < 4; week++) {
  for (const id of ['riunione', 'riunione', 'leadership']) { try { store.performWeeklyActivity(id); } catch { /* time or capital exhausted */ } }
  store.advance(7);
}
state = store.getState();
assert.ok(state.game.party.support > 55, 'Le riunioni fanno crescere il sostegno interno.');
const rank = store.contestPartyRank();
state = store.getState();
assert.equal(rank.success, true, `Incarico interno atteso (punteggio ${rank.score}).`);
assert.equal(state.game.party.rankTitle, 'Coordinatore locale');
assert.ok(state.dataset.offices.some(item => item.level === 'partito' && !item.endDate));
assert.ok(state.game.objectives.partito, 'Il traguardo di partito è registrato.');
assert.throws(() => store.contestPartyRank(), /tre settimane|giorni|capitale/);

// 5. Calendario e candidatura: preparazione, fondi e sostegno interno entrano nella campagna.
store.advance(7);
for (const id of ['preparazione', 'squadra']) store.performWeeklyActivity(id);
assert.ok(store.getState().game.prep >= 18);
store.fastForwardToElection('comunale');
state = store.getState();
const window = state.game.elections.find(item => item.type === 'comunale' && item.status === 'open');
assert.ok(window, 'La finestra delle candidature comunali è aperta.');
const fundsBefore = state.game.resources.funds;
const prepBefore = state.game.prep;
const campaign = store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'fino-15000' }, []);
state = store.getState();
assert.equal(campaign.electionDate, window.electionDate, 'La campagna si chiude nel giorno fissato dal calendario.');
assert.equal(campaign.preparation.prep, prepBefore);
assert.equal(campaign.preparation.transfer, Math.round(fundsBefore * 0.6));
assert.equal(state.game.prep, 0);
assert.equal(state.game.elections.find(item => item.id === window.id).status, 'running');
assert.ok(campaign.preparation.partyBonus > 0, 'Sostegno interno e leadership migliorano la candidatura.');
assert.throws(() => store.performWeeklyActivity('ascolto'), /campagna/);

// 6. Elezione vinta: nuovo incarico, calendario aggiornato, partito e traguardi.
const supportBefore = state.game.party.support;
finishCampaign(store, 80);
state = store.getState();
assert.equal(state.campaign.result.personalMandate, true);
assert.ok(state.dataset.offices.some(item => item.title === 'Sindaco' && !item.endDate));
assert.equal(state.game.elections.find(item => item.id === window.id).status, 'held');
assert.ok(state.game.elections.some(item => item.type === 'comunale' && item.status === 'upcoming'), 'Il prossimo turno comunale è in calendario.');
assert.ok(state.game.party.support > supportBefore - 2);
assert.ok(state.game.objectives.elezione && state.game.objectives.candidatura);
store.clearCampaign();

// 7. Elezione saltata: se non ti ricandidi, il mandato si chiude.
store.fastForwardToElection('comunale');
for (let week = 0; week < 3; week++) store.advance(7);
state = store.getState();
assert.ok(state.dataset.offices.find(item => item.title === 'Sindaco').endDate, 'Il sindaco che non si ricandida lascia l’incarico.');

// 8. Espulsione: con il sostegno interno a pezzi il partito apre un procedimento.
store = await reload(saved => { saved.game.party.support = 8; saved.game.status = 'active'; });
store.advance(7);
let urgent = store.getState().game.inbox.find(item => item.templateId === 'espulsione');
assert.ok(urgent, 'Il procedimento di espulsione arriva in agenda.');
store.resolveAgendaItem(urgent.id, 'rompi');
state = store.getState();
assert.equal(state.game.party, null);
assert.equal(state.career.partyId, null);
assert.equal(state.dataset.politicians[0].partyId, null);
assert.ok(state.dataset.offices.filter(item => item.level === 'partito').every(item => item.endDate));
store.advance(7);
store.joinParty(realParty.id, [realParty]);
state = store.getState();
assert.equal(state.game.party.partyId, realParty.id);
assert.equal(state.dataset.parties.some(item => item.id === realParty.id), false, 'Il partito reale resta un riferimento, non viene copiato.');

// 9. Dimissioni e fine della carriera: la reputazione a terra può chiudere la partita.
store = await reload(saved => setStat(saved, 'reputation', 6));
store.advance(7);
urgent = store.getState().game.inbox.find(item => item.templateId === 'dimissioni');
assert.ok(urgent, 'Le richieste di dimissioni arrivano in agenda.');
store.resolveAgendaItem(urgent.id, 'dimettiti');
state = store.getState();
assert.ok(state.dataset.offices.filter(item => item.level !== 'partito' && !/inizial/i.test(item.title)).every(item => item.endDate));
let ended = false;
for (let attempt = 0; attempt < 30 && !ended; attempt++) {
  store = await reload(saved => { setStat(saved, 'reputation', 5); saved.game.rngState = 1000 + attempt * 7919; saved.game.status = 'active'; });
  store.advance(7);
  const item = store.getState().game.inbox.find(entry => entry.templateId === 'dimissioni');
  if (!item) continue;
  store.resolveAgendaItem(item.id, 'resisti');
  ended = store.getState().game.status === 'ended';
}
assert.ok(ended, 'Resistere può costare la carriera.');
assert.throws(() => store.performWeeklyActivity('ascolto'), /conclusa/);
const endedDate = store.getState().clock.currentDate;
store.advance(7);
assert.equal(store.getState().clock.currentDate, endedDate, 'Una carriera conclusa non avanza.');

// 10. Parlamento: lavoro in Aula, diplomazia, trattative respinte con rapporti tesi, stabilità ed elezioni anticipate.
store.reset();
store.createCareer(draft('deputato', { partyMode: 'new', partyId: '', partyName: 'Lista di prova', partyAbbreviation: 'LDP', partyDescription: 'Partito fondato dal giocatore per il test.', partyOrientation: 'Altro', partyColor: '#285c42' }), [realParty], groups);
state = store.getState();
assert.equal(state.game.party.affiliation, 'founder', 'Chi fonda un partito ne è il segretario.');
const groupSupport = state.parliament.careerStanding.partySupport;
store.performWeeklyActivity('aula');
assert.ok(store.getState().parliament.careerStanding.partySupport > groupSupport);
store.performWeeklyActivity('diplomazia', 'cam-xix-01');
assert.ok(store.getState().parliament.relations['cam-xix-01'].value > 50);
assert.equal(store.getState().game.resources.politicalCapital, store.getState().parliament.resources.politicalCapital, 'Un solo capitale politico per carriera e Parlamento.');
const law = store.proposeLaw({ title: 'Rete dei musei civici', category: 'Scuola', summary: 'Collega i musei civici in una rete simulata.' });
store.advanceLaw(law.id, 'present');
store.advanceLaw(law.id, 'complete-commission');
store.advance(7);
store = await reload(saved => { saved.parliament.relations['cam-xix-02'].value = 20; });
const capital = store.getState().game.resources.politicalCapital;
store.negotiateLaw(law.id, 'cam-xix-02');
state = store.getState();
assert.equal(state.parliament.history.at(-1).type, 'negoziato-rifiutato', 'Con rapporti tesi il gruppo rifiuta la trattativa.');
assert.equal(state.game.resources.politicalCapital, capital - 2);
assert.equal(state.game.week.ap, 5, 'Anche il lavoro parlamentare consuma giorni.');
store.formGovernment(['cam-xix-01', 'cam-xix-03', 'cam-xix-04', 'senato-xix-gruppo-85', 'senato-xix-gruppo-33', 'senato-xix-gruppo-56']);
store.voteGovernmentConfidence();
state = store.getState();
assert.equal(state.parliament.government.status, 'active');
assert.ok(state.parliament.government.stability >= 25);
for (let week = 0; week < 3; week++) store.advance(7);
assert.ok(Number.isFinite(store.getState().parliament.government.stability), 'La stabilità del governo evolve settimana per settimana.');
store.reviseGovernmentCoalition(['cam-xix-10', 'senato-xix-gruppo-9']);
store.voteGovernmentConfidence();
assert.equal(store.getState().parliament.government.status, 'fallen');
const scheduled = store.getState().game.elections.find(item => item.type === 'politiche' && item.status === 'upcoming').windowOpensAt;
for (let week = 0; week < 5; week++) store.advance(7);
const early = store.getState().game.elections.find(item => item.type === 'politiche' && item.early);
assert.ok(early && early.windowOpensAt < scheduled, 'Senza governo si va alle politiche anticipate.');

// 11. Salvataggio e ripristino della settimana di gioco.
const snapshot = store.getState();
store.save();
store = await load();
assert.equal(store.getState().game.week.index, snapshot.game.week.index);
assert.deepEqual(store.getState().game.inbox.map(item => item.id), snapshot.game.inbox.map(item => item.id));
assert.deepEqual(store.getState().game.elections, snapshot.game.elections);

// 12. Provenienza: gioco e statistiche simulati, personaggio dell’utente, dati reali invariati.
state = store.getState();
assert.ok(state.dataset.statistics.every(item => item.source === 'simulation'));
assert.equal(state.dataset.politicians[0].source, 'user');
assert.ok(state.game.relations.every(item => item.source === 'simulation'));
assert.ok(state.game.log.every(item => item.source === 'simulation'));
assert.equal(JSON.stringify(parties), realSnapshot, 'Il dataset reale non viene modificato dal gioco.');

console.log('Gameplay verificato: inizio carriera, settimane con tempo e risorse, attività, decisioni, partito e correnti, incarico interno, calendario e candidatura, elezione vinta e saltata, espulsione, dimissioni e fine carriera, Parlamento con rapporti e trattative, stabilità e elezioni anticipate, salvataggio.');
