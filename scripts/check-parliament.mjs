import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeCareerDraft, renderCareerWizard } from '../src/ui/career-wizard.js';
import { renderParliamentPage } from '../src/ui/parliament-mode.js';
import { makeDemoState } from '../src/data/simulation/demo.js';
import { canManageParliament as canManage } from '../src/core/parliament-engine.js';

const localStore = new Map();
globalThis.localStorage = {
  getItem: key => localStore.get(key) ?? null,
  setItem: (key, value) => localStore.set(key, String(value)),
  removeItem: key => localStore.delete(key)
};
const read = async name => JSON.parse(await readFile(new URL('../src/data/real/' + name + '.json', import.meta.url), 'utf8'));
const groups = await read('parliamentary-groups');
const parties = await read('parties');
const party = parties.find(item => item.id === 'party-futuro-nazionale');
const demo = makeDemoState();
const draftFor = (level, extra = {}) => ({
  firstName: 'Alessia', lastName: 'Verdi', birthDate: '1988-04-20', gender: 'donna',
  region: 'Lombardia', municipality: 'Milano', previousProfession: 'Ricercatrice',
  initialLevel: level, partyMode: 'independent', partyId: '', currentDate: demo.clock.currentDate,
  parliamentaryGroupId: level === 'deputato' ? 'cam-xix-01' : level === 'senatore' ? 'senato-xix-gruppo-85' : '',
  parliamentStartMode: 'real-context', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 }, ...extra
});
// Parliamentary actions cost working days: when the week is used up the player closes it, as in the game.
const TIMED = ['proposeLaw', 'advanceLaw', 'amendLaw', 'compromiseLaw', 'negotiateLaw', 'formGovernment', 'negotiateGovernmentSupport', 'reviseGovernmentCoalition', 'assignMinister', 'voteGovernmentConfidence', 'triggerGovernmentCrisis', 'contestCommitteeRole', 'joinParliamentaryGroup'];
const weekly = target => {
  for (const name of TIMED) {
    const original = target[name];
    if (original.weekly) continue;
    target[name] = (...args) => { if (target.getState().game.week.ap < 1) target.advance(7); return original(...args); };
    target[name].weekly = true;
  }
  return target;
};
let module = await import('../src/core/store.js?parliament-check=' + Date.now());
let store = weekly(module.store);

for (const level of ['comunale', 'regionale', 'deputato', 'senatore']) {
  store.reset();
  const draft = draftFor(level);
  const player = store.createCareer(draft, [party], groups);
  const state = store.getState();
  assert.equal(player.source, 'user', level + ': il personaggio è creato dall’utente');
  assert.ok(state.dataset.statistics.filter(item => item.subjectId === player.id).every(item => item.source === 'simulation'));
  assert.equal(state.career.initialLevel, level);
  if (level === 'deputato' || level === 'senatore') {
    const chamber = level === 'deputato' ? 'camera' : 'senato';
    assert.equal(state.parliament.player.chamber, chamber);
    assert.equal(state.parliament.player.groupId, draft.parliamentaryGroupId);
    assert.equal(state.parliament.source, 'simulation');
    assert.equal(state.parliament.chambers[chamber].groups.find(item => item.groupId === draft.parliamentaryGroupId).source, 'simulation');
    assert.equal(state.parliament.chambers[chamber].groups.find(item => item.groupId === draft.parliamentaryGroupId).reference.source, 'real');
    assert.ok(renderParliamentPage('parlamento', state, { party }).includes('Composizione'));
  } else {
    assert.equal(state.parliament, null);
  }
}

store.reset();
store.createCareer(draftFor('regionale', { partyMode: 'new', partyName: 'Lista Nuova', partyAbbreviation: 'LN', partyDescription: 'Organizzazione creata per la partita.', partyOrientation: 'Centrismo civico', partyColor: '#285c42' }), [party], groups);
assert.ok(store.getState().dataset.parties.some(item => item.source === 'user' && item.name === 'Lista Nuova'));

store.reset();
const deputyDraft = draftFor('deputato', { partyMode: 'existing', partyId: party.id });
store.createCareer(deputyDraft, [party], groups);
let state = store.getState();
assert.equal(state.career.partyId, party.id);
assert.equal(state.dataset.parties.some(item => item.id === party.id), false, 'Il riferimento reale non viene copiato nel dataset della carriera.');
// Only a party secretary can form a government: a rank-and-file member cannot.
assert.throws(() => store.formGovernment(['cam-xix-01', 'cam-xix-02', 'cam-xix-03', 'senato-xix-gruppo-85', 'senato-xix-gruppo-49', 'senato-xix-gruppo-33']), /segretario/);
const founder = { partyMode: 'new', partyId: '', partyName: 'Lista di prova', partyAbbreviation: 'LDP', partyDescription: 'Partito fondato dal giocatore per il test.', partyOrientation: 'Altro', partyColor: '#285c42' };
assert.equal(state.career.parliamentContext.groupId, deputyDraft.parliamentaryGroupId);
assert.equal(state.career.parliamentContext.source, 'simulation');
assert.ok(state.dataset.offices[0].institution === 'Camera dei deputati');
const renderedWizard = renderCareerWizard(state, { ...makeCareerDraft(state.clock.currentDate), step: 2, initialLevel: 'deputato', parliamentaryGroupId: 'cam-xix-01' }, [party], () => party.logoAsset, groups);
assert.ok(renderedWizard.includes('data-level="deputato"'));
assert.ok(renderedWizard.includes('data-level="senatore"'));
assert.ok(renderedWizard.includes('data-group-id="cam-xix-01"'));
assert.ok(renderedWizard.includes('Parti da un contesto parlamentare reale'));

// Passa una legge nei due rami del procedimento; il secondo voto usa il Senato.
let law = store.proposeLaw({ title: 'Fondo per i servizi locali', category: 'Welfare', summary: 'Istituisce un fondo simulato per rafforzare i servizi di prossimità.' });
store.advanceLaw(law.id, 'present');
store.advanceLaw(law.id, 'complete-commission');
store.compromiseLaw(law.id);
store.compromiseLaw(law.id);
store.compromiseLaw(law.id);
store.advanceLaw(law.id, 'vote');
law = store.getState().parliament.laws.find(item => item.id === law.id);
assert.equal(law.stage, 'other-chamber');
assert.equal(law.votes[0].source, 'simulation');
store.advanceLaw(law.id, 'transmit');
law = store.getState().parliament.laws.find(item => item.id === law.id);
assert.equal(law.currentChamber, 'senato');
store.advanceLaw(law.id, 'final-vote');
law = store.getState().parliament.laws.find(item => item.id === law.id);
assert.equal(law.stage, 'approved');
assert.equal(law.votes.length, 2);
assert.ok(store.getState().career.parliamentHistory.some(item => item.type === 'legge-proposta'));
assert.ok(store.getState().dataset.laws.every(item => item.source === 'simulation'));

// A three-group coalition in each House obtains confidence; minister and crisis persist in history.
{
  const lawState = store.getState();
  store.reset();
  store.createCareer(draftFor('deputato', founder), [party], groups);
  assert.ok(lawState.parliament.laws.length, 'La legge del deputato resta nella sua carriera.');
}
const coalition = ['cam-xix-01','cam-xix-02','cam-xix-03','senato-xix-gruppo-85','senato-xix-gruppo-49','senato-xix-gruppo-33'];
store.formGovernment(coalition);
store.voteGovernmentConfidence();
state = store.getState();
assert.equal(state.parliament.government.status, 'active');
store.assignMinister('Economia e finanze', 'cam-xix-01');
store.triggerGovernmentCrisis();
assert.equal(store.getState().parliament.government.status, 'crisis');
store.voteGovernmentConfidence();
assert.equal(store.getState().parliament.government.status, 'active');

// A narrow government loses confidence in both Houses.
store.reviseGovernmentCoalition(['cam-xix-10','senato-xix-gruppo-9']);
store.voteGovernmentConfidence();
assert.equal(store.getState().parliament.government.status, 'fallen');
assert.ok(store.getState().parliament.history.some(item => item.type === 'crisi-governo'));
assert.ok(store.getState().dataset.events.every(item => item.source === 'simulation'));

// A forced vote on a small-group senator proposal can fail at the first chamber.
store.reset();
const senator = draftFor('senatore', { parliamentaryGroupId: 'senato-xix-gruppo-9' });
store.createCareer(senator, [party], groups);
const rejected = store.proposeLaw({ title: 'Intervento territoriale', category: 'Infrastrutture', summary: 'Avvia un piano dimostrativo per collegamenti locali.' });
store.advanceLaw(rejected.id, 'present');
store.advanceLaw(rejected.id, 'complete-commission');
store.advanceLaw(rejected.id, 'force-vote');
assert.equal(store.getState().parliament.laws.find(item => item.id === rejected.id).stage, 'rejected');
store.save();
module = await import('../src/core/store.js?parliament-law-reload=' + Date.now());
assert.equal(module.store.getState().parliament.laws.find(item => item.id === rejected.id).stage, 'rejected');
store = weekly(module.store);

// A campaign winner can enter the real-context flow and choose a group explicitly.
store.reset();
store.createCareer(draftFor('regionale'), [party], groups);
state = store.getState();
state = { ...state, career: { ...state.career, initialLevel: 'senatore', parliamentContext: { mode: 'real-context', chamber: 'senato', groupId: null, source: 'simulation' } } };
localStore.set('palazzo-2026.career.v1', JSON.stringify(state));
module = await import('../src/core/store.js?parliament-reload=' + Date.now());
store = weekly(module.store);
store.initializeParliament(groups);
store.joinParliamentaryGroup('senato-xix-gruppo-85');
store.save();
module = await import('../src/core/store.js?parliament-reload-save=' + Date.now());
assert.equal(module.store.getState().parliament.player.groupId, 'senato-xix-gruppo-85');
assert.equal(module.store.getState().parliament.laws.length, 0);
assert.equal(module.store.getState().version, 6);
assert.ok(renderParliamentPage('leggi', module.store.getState()).includes('Scrivi una proposta.'));

const unique = list => new Set(list.map(item => item.id)).size === list.length;
const references = [party];

// Incarichi parlamentari: candidatura, finestra di attesa, rigenerazione del capitale e ufficio in carriera.
store.reset();
store.createCareer(draftFor('deputato', { parliamentaryGroupId: 'cam-xix-01', ...founder }), references, groups);
assert.ok(store.getState().parliament.careerStanding, 'Il salvataggio parlamentare nasce con la posizione di carriera.');
assert.ok(renderParliamentPage('parlamento', store.getState()).includes('data-parliament-action="contest-role"'));
store.contestCommitteeRole();
state = store.getState();
assert.equal(state.parliament.careerStanding.committeeRole.title, 'Responsabile di commissione');
const roleOffice = state.dataset.offices.find(item => item.title.startsWith('Responsabile di commissione'));
assert.ok(roleOffice && roleOffice.endDate === null && roleOffice.source === 'simulation');
assert.throws(() => store.contestCommitteeRole(), /finestra di 30 giorni/);
const capitalBefore = state.parliament.resources.politicalCapital;
store.advance(7);
assert.ok(store.getState().parliament.resources.politicalCapital > capitalBefore, 'Il capitale politico si rigenera con il tempo.');
assert.ok(store.getState().dataset.events.at(-1).title.includes('lavori parlamentari'));
store.joinParliamentaryGroup('cam-xix-03');
state = store.getState();
assert.equal(state.parliament.player.groupId, 'cam-xix-03');
assert.equal(state.parliament.careerStanding.committeeRole, null, 'Il cambio di gruppo interrompe gli incarichi di gruppo.');
assert.ok(state.dataset.offices.find(item => item.id === roleOffice.id).endDate, 'L’ufficio simulato viene chiuso.');
assert.equal(state.career.parliamentContext.groupId, 'cam-xix-03');
assert.equal(state.parliament.chambers.camera.groups.find(item => item.groupId === 'cam-xix-01').simulatedSeats, 118);
assert.equal(state.parliament.chambers.camera.groups.find(item => item.groupId === 'cam-xix-03').simulatedSeats, 58);
assert.equal(groups.find(item => item.id === 'cam-xix-03').memberCount, 57, 'Il dato reale resta invariato.');
assert.ok(unique(state.career.parliamentHistory) && unique(state.dataset.events), 'Lo storico non duplica gli eventi.');

// Governo: una sola trattativa aperta, coalizione su entrambe le Camere, ministro del giocatore e caduta.
assert.throws(() => store.formGovernment(['cam-xix-01']), /Camera e uno al Senato/);
store.formGovernment(['cam-xix-01', 'cam-xix-03', 'cam-xix-04', 'senato-xix-gruppo-85', 'senato-xix-gruppo-33', 'senato-xix-gruppo-56']);
assert.throws(() => store.formGovernment(['cam-xix-02', 'senato-xix-gruppo-49']), /già un governo/);
store.voteGovernmentConfidence();
assert.equal(store.getState().parliament.government.status, 'active');
store.assignMinister('Interno', null, 'player');
state = store.getState();
const ministerOffice = state.dataset.offices.find(item => item.title.startsWith('Ministro · Interno'));
assert.ok(ministerOffice && !ministerOffice.endDate);
assert.throws(() => store.assignMinister('Salute', null, 'player'), /già un incarico di governo/);
store.assignMinister('Salute', 'cam-xix-04');
assert.ok(renderParliamentPage('governo', store.getState()).includes('Il tuo incarico di governo'));
store.reviseGovernmentCoalition(['cam-xix-01', 'cam-xix-03', 'senato-xix-gruppo-85', 'senato-xix-gruppo-33']);
state = store.getState();
assert.ok(state.parliament.government.ministers.find(item => item.portfolio === 'Salute').endedAt, 'I ministri dei gruppi usciti decadono.');
assert.ok(!state.parliament.government.ministers.find(item => item.portfolio === 'Interno').endedAt);
store.reviseGovernmentCoalition(['cam-xix-10', 'senato-xix-gruppo-9']);
store.voteGovernmentConfidence();
state = store.getState();
assert.equal(state.parliament.government.status, 'fallen');
assert.ok(state.dataset.offices.find(item => item.id === ministerOffice.id).endDate, 'La caduta del governo chiude il ministero del giocatore.');
assert.ok(renderParliamentPage('governo', state).includes('data-parliament-action="form-government"'), 'Dopo la caduta si può formare un nuovo governo.');

// Una legge dell’opposizione trova la maggioranza contraria; si può trattare anche nella seconda Camera.
store.formGovernment(['cam-xix-01', 'cam-xix-02', 'cam-xix-04', 'senato-xix-gruppo-85', 'senato-xix-gruppo-56', 'senato-xix-gruppo-33']);
store.voteGovernmentConfidence();
assert.equal(store.getState().parliament.government.status, 'active');
const oppositionLaw = store.proposeLaw({ title: 'Registro dei servizi', category: 'Pubblica amministrazione', summary: 'Semplifica l’accesso ai servizi con un registro unico simulato.' });
store.advanceLaw(oppositionLaw.id, 'present');
store.advanceLaw(oppositionLaw.id, 'complete-commission');
store.negotiateLaw(oppositionLaw.id, 'cam-xix-01');
store.compromiseLaw(oppositionLaw.id); store.compromiseLaw(oppositionLaw.id); store.compromiseLaw(oppositionLaw.id);
store.advanceLaw(oppositionLaw.id, 'vote');
let tracked = store.getState().parliament.laws.find(item => item.id === oppositionLaw.id);
assert.equal(tracked.stage, 'other-chamber', 'Negoziato e compromessi portano la proposta oltre la prima Camera.');
assert.ok(tracked.votes[0].byGroup.find(item => item.groupId === 'cam-xix-04').yesVotes < 52 * 0.6, 'La maggioranza non negoziata segue la linea del governo.');
store.advanceLaw(oppositionLaw.id, 'transmit');
store.negotiateLaw(oppositionLaw.id, 'senato-xix-gruppo-85');
tracked = store.getState().parliament.laws.find(item => item.id === oppositionLaw.id);
assert.deepEqual(tracked.negotiatedGroupIds, ['senato-xix-gruppo-85'], 'La trattativa nella seconda Camera riparte dai suoi gruppi.');
store.advanceLaw(oppositionLaw.id, 'final-vote');
assert.ok(['approved', 'rejected'].includes(store.getState().parliament.laws.find(item => item.id === oppositionLaw.id).stage));

// Campagna → Parlamento: un seggio vinto apre il mandato, una sconfitta da uscente lo chiude.
const finishCampaign = (share) => {
  const campaign = store.getState().campaign;
  campaign.nomination.status = 'approved';
  campaign.candidacy.listPosition = 1;
  campaign.nomination.listPosition = 1;
  for (const area of campaign.territories) {
    const ids = Object.keys(area.supportByCandidate);
    const others = ids.filter(id => id !== campaign.playerCandidateId);
    area.supportByCandidate = Object.fromEntries(ids.map(id => [id, id === campaign.playerCandidateId ? share : (100 - share) / others.length]));
  }
  campaign.day = campaign.totalDays - 1;
  store.advance(1);
  assert.equal(store.getState().campaign.status, 'finished');
};
store.reset();
store.createCareer(draftFor('regionale'), references, groups);
store.initializeParliament(groups);
assert.equal(store.getState().parliament.player, null, 'Un percorso regionale osserva il Parlamento senza seggio.');
store.fastForwardToElection('politiche');
store.startCampaign({ electionType: 'politiche', role: 'senatore', objective: 'win' }, references);
finishCampaign(80);
state = store.getState();
assert.equal(state.campaign.result.personalMandate, true);
assert.equal(state.career.initialLevel, 'regionale', 'Il livello iniziale resta quello scelto nel wizard.');
assert.equal(state.career.currentLevel, 'senatore');
assert.equal(state.parliament.player.chamber, 'senato');
assert.equal(state.parliament.player.groupId, null);
assert.ok(renderParliamentPage('parlamento', state).includes('Scegli il gruppo di riferimento'));
store.joinParliamentaryGroup('senato-xix-gruppo-71');
assert.ok(canManage(store.getState().parliament));

store.reset();
store.createCareer(draftFor('deputato', { parliamentaryGroupId: 'cam-xix-02' }), references, groups);
const pending = store.proposeLaw({ title: 'Piano per le biblioteche', category: 'Scuola', summary: 'Rafforza le biblioteche scolastiche nello scenario di gioco.' });
store.fastForwardToElection('politiche');
store.startCampaign({ electionType: 'politiche', role: 'deputato', objective: 'win' }, references);
assert.equal(store.getState().campaign.candidacy.incumbent, true);
finishCampaign(1);
state = store.getState();
assert.equal(state.campaign.result.personalMandate, false);
assert.equal(state.parliament.player, null, 'Il seggio non confermato chiude il mandato.');
assert.equal(state.career.parliamentContext, null);
assert.equal(state.parliament.laws.find(item => item.id === pending.id).stage, 'lapsed');
assert.equal(state.parliament.chambers.camera.groups.find(item => item.groupId === 'cam-xix-02').simulatedSeats, 68);
assert.ok(state.dataset.offices.every(item => item.endDate), 'Gli incarichi parlamentari risultano conclusi.');
assert.ok(state.career.pastParliamentContexts.length === 1);
assert.throws(() => store.proposeLaw({ title: 'Nuova proposta', category: 'Scuola', summary: 'Testo sufficiente per la prova.' }));
store.initializeParliament(groups);
assert.equal(store.getState().parliament.player, null, 'Il ricaricamento dei gruppi non riapre un mandato concluso.');

// Una campagna non parlamentare non tocca il seggio di un parlamentare in carica.
store.reset();
store.createCareer(draftFor('senatore', { parliamentaryGroupId: 'senato-xix-gruppo-49' }), references, groups);
store.fastForwardToElection('comunale');
store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'build' }, references);
assert.equal(store.getState().campaign.candidacy.incumbent, false);
const campaignClock = store.getState().clock.currentDate;
store.proposeLaw({ title: 'Mozione sui trasporti', category: 'Infrastrutture', summary: 'Proposta presentata durante la campagna elettorale.' });
assert.equal(store.getState().clock.currentDate, campaignClock, 'Durante la campagna il calendario resta quello della campagna.');
store.advance(7);
assert.equal(store.getState().clock.currentDate, store.getState().campaign.currentDate);
finishCampaign(1);
assert.equal(store.getState().parliament.player.groupId, 'senato-xix-gruppo-49');
assert.ok(store.getState().dataset.offices.some(item => item.institution === 'Senato della Repubblica' && !item.endDate));

// Ripristino: un salvataggio della build precedente senza posizione di carriera viene completato;
// un salvataggio illeggibile viene conservato a parte invece di essere sovrascritto.
state = JSON.parse(JSON.stringify(store.getState()));
delete state.parliament.careerStanding;
delete state.parliament.pastMandates;
state.parliament.laws = state.parliament.laws.map(({ negotiatedGroupIds, ...law }) => law);
localStore.set('palazzo-2026.career.v1', JSON.stringify(state));
module = await import('../src/core/store.js?parliament-legacy=' + Date.now());
assert.ok(module.store.getState().parliament.careerStanding);
assert.deepEqual(module.store.getState().parliament.pastMandates, []);
assert.ok(renderParliamentPage('parlamento', module.store.getState()).includes('INCARICHI PARLAMENTARI'));
localStore.set('palazzo-2026.career.v1', JSON.stringify({ version: 5, dataset: null }));
module = await import('../src/core/store.js?parliament-corrupt=' + Date.now());
assert.equal(module.store.getState().career.id, 'carriera-demo');
assert.ok(JSON.parse(localStore.get('palazzo-2026.career.v1.backup')).payload.includes('"dataset":null'));
localStore.set('palazzo-2026.career.v1', JSON.stringify({ ...makeDemoState(), version: 4, career: { ...makeDemoState().career, initialLevel: 'nazionale' } }));
module = await import('../src/core/store.js?parliament-v4=' + Date.now());
assert.equal(module.store.getState().version, 6);
assert.equal(module.store.getState().parliament, null);

console.log('Career Wizard verificato: quattro percorsi, partito indipendente/reale/utente, gruppo distinto e contesto parlamentare. Parlamento, leggi, emendamenti, voti, fiducia, crisi, storico e ricaricamento verificati. Incarichi, cambio di gruppo, ministro, caduta del governo, integrazione con la campagna e ripristino dei salvataggi verificati.');
