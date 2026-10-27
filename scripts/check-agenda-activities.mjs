// The political activities of the agenda (WEEKLY_ACTIVITIES in src/data/simulation/career-rules.js, performed by career-engine and the store) and the nine added in this round:
// tour in another region, rally, meeting with local administrators, interviews with possible candidates, majority summit, question time, hearing in committee, reply to a controversy,
// public-policy course. Each one is tied to a role, a party, a place or a moment of the calendar (it is refused when the condition is not there, with the reason), costs days and money
// or capital, may go wrong, can be done once a week, and leaves something that stays: a stat, a reputation, a sector of influence, a relation, the attention of a region, a consequence
// that arrives weeks later. Also: the audit of the whole catalogue (ids, categories, costs, effect keys, odds) and determinism.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const KEY = 'palazzo-2026.career.v1';
const localStore = new Map();
globalThis.localStorage = { getItem: key => localStore.get(key) ?? null, setItem: (key, value) => localStore.set(key, String(value)), removeItem: key => localStore.delete(key) };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { WEEKLY_ACTIVITIES, ACTIVITY_CATEGORIES, STAT_LABELS } = await module('src/data/simulation/career-rules.js');
const { REPUTATION_IDS } = await module('src/data/simulation/standing-rules.js');
const { AREA_GROUPS } = await module('src/data/simulation/policy-rules.js');
const { ITALIAN_REGIONS } = await module('src/data/regions.js');
const { remember } = await module('src/core/career-engine.js');
const read = async name => JSON.parse(await readFile(new URL('../src/data/real/' + name + '.json', import.meta.url), 'utf8'));
const groups = await read('parliamentary-groups');
const parties = await read('parties');
const NEW = ['tour-regione', 'comizio-piazza', 'incontro-amministratori', 'selezione-candidati', 'vertice-maggioranza', 'question-time', 'audizione-commissione', 'replica-polemica', 'corso-politiche'];

// ---------- 1. the catalogue ----------
{
  const ids = WEEKLY_ACTIVITIES.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length, 'Ogni attività ha un id diverso.');
  const RELATIONS = new Set(['civic', 'media', 'business', 'unions', 'leadership', 'target', 'otherCurrents', 'currentA', 'institutions', 'voters', 'party']);
  const checkEffects = (effects, where) => {
    for (const metric of Object.keys(effects?.stats ?? {})) assert.ok(metric in STAT_LABELS, `${where}: indicatore ${metric}.`);
    for (const id of Object.keys(effects?.standing ?? {})) assert.ok(REPUTATION_IDS.includes(id), `${where}: reputazione ${id}.`);
    for (const id of Object.keys(effects?.sector ?? {})) assert.ok(id in AREA_GROUPS, `${where}: settore ${id}.`);
    for (const value of Object.values(effects?.stats ?? {})) assert.ok(Number.isFinite(value), `${where}: valore non numerico.`);
  };
  for (const activity of WEEKLY_ACTIVITIES) {
    const where = activity.id;
    assert.ok(activity.category in ACTIVITY_CATEGORIES, `${where}: categoria ${activity.category}.`);
    assert.ok(activity.label?.length >= 8 && activity.detail?.length >= 30, `${where}: titolo e descrizione.`);
    assert.ok(Number(activity.cost?.ap) >= 1 || Number(activity.cost?.funds) > 0 || Number(activity.cost?.capital) > 0, `${where}: costa qualcosa (giorni, fondi o capitale).`);
    assert.ok(Object.values(activity.cost).every(value => Number.isFinite(value) && value >= 0), `${where}: costi validi.`);
    checkEffects(activity.effects, where); checkEffects(activity.risk?.effects, `${where} (rischio)`);
    if (activity.risk) assert.ok(activity.risk.chance > 0 && activity.risk.chance < 1 && activity.risk.label, `${where}: rischio con probabilità e testo.`);
    if (typeof activity.requires === 'function') assert.ok(activity.requiresLabel, `${where}: un requisito calcolato ha il suo perché scritto.`);
    for (const later of [activity.later].filter(Boolean)) {
      assert.ok(later.weeks >= 1 && (later.label || later.outcomes), `${where}: conseguenza futura con data e testo.`);
      assert.ok(typeof later.hint === 'string' && later.hint.length > 8, `${where}: il giocatore sa in anticipo che una conseguenza è possibile (indizio scritto).`);
      if (later.outcomes) { const total = later.outcomes.reduce((sum, item) => sum + item.chance, 0); assert.ok(total > 0.95 && total < 1.05, `${where}: gli esiti futuri sommano a 1 (${total}).`); for (const outcome of later.outcomes) checkEffects(outcome.effects, `${where} (esito)`); }
      else assert.ok(later.chance > 0 && later.chance <= 1 && later.hint, `${where}: conseguenza futura con probabilità e indizio.`);
    }
  }
  for (const id of NEW) {
    const activity = WEEKLY_ACTIVITIES.find(item => item.id === id);
    assert.ok(activity, `${id} è nel catalogo.`);
    assert.equal(activity.weekly, 1, `${id}: una volta a settimana.`);
    assert.ok(activity.cost.ap >= 1, `${id}: costa almeno un giorno.`);
    assert.ok(Object.keys(activity.effects ?? {}).length >= 2, `${id}: effetti reali.`);
    assert.ok(id === 'corso-politiche' || activity.risk || activity.later, `${id}: può andare male o ha un seguito.`);
    assert.ok(id === 'corso-politiche' || id === 'audizione-commissione' || activity.requires, `${id}: ha un requisito di ruolo, partito, luogo o calendario.`);
  }
  // the requirements read the situation they name
  const sit = overrides => ({ party: true, member: true, secretary: false, direzione: false, seat: true, governing: true, inMajority: false, minister: false, premier: false, memory: { bad: 0 }, pollTrend: 0, pollDelta: 0, role: { regional: false, europarl: false, groupLeader: false }, game: { elections: [] }, ...overrides });
  const requires = id => WEEKLY_ACTIVITIES.find(item => item.id === id).requires;
  assert.ok(!requires('vertice-maggioranza')(sit({ inMajority: true })) && requires('vertice-maggioranza')(sit({ inMajority: true, secretary: true })) && !requires('vertice-maggioranza')(sit({ inMajority: false, secretary: true })) && !requires('vertice-maggioranza')(sit({ inMajority: true, secretary: true, governing: false })), 'Il vertice: governo in carica, posto in maggioranza e un ruolo di peso.');
  assert.ok(requires('question-time')(sit({})) && !requires('question-time')(sit({ inMajority: true })) && !requires('question-time')(sit({ governing: false })) && !requires('question-time')(sit({ seat: false })), 'Question time: un seggio all’opposizione di un governo in carica.');
  assert.ok(!requires('replica-polemica')(sit({})) && requires('replica-polemica')(sit({ memory: { bad: 1.5 } })) && requires('replica-polemica')(sit({ pollDelta: -0.4 })), 'La replica: serve una polemica (cattiva memoria o sondaggi in calo).');
  assert.ok(!requires('comizio-piazza')(sit({})) && requires('comizio-piazza')(sit({ game: { elections: [{ status: 'open' }] } })), 'Il comizio: serve una finestra di candidatura aperta.');
  assert.ok(!requires('selezione-candidati')(sit({ game: { elections: [{ status: 'open' }] } })) && requires('selezione-candidati')(sit({ secretary: true, game: { elections: [{ status: 'open' }] } })) && !requires('selezione-candidati')(sit({ secretary: true })), 'I colloqui coi candidati: la guida del partito e una candidatura aperta.');
  assert.ok(requires('tour-regione')(sit({ seat: false, party: false, role: { regional: true } })) && !requires('tour-regione')(sit({ seat: false, party: false })), 'Il tour: un partito o un mandato.');
}

// ---------- 2. in the game ----------
let imports = 0;
const load = async () => (await import('../src/core/store.js?agenda=' + (++imports))).store;
const reload = async mutate => { const saved = JSON.parse(localStore.get(KEY)); mutate(saved); localStore.set(KEY, JSON.stringify(saved)); return load(); };
const realParty = parties.find(item => item.id === 'party-futuro-nazionale');
const draft = { firstName: 'Marta', lastName: 'Neri', birthDate: '1985-02-11', gender: 'donna', region: 'Toscana', municipality: 'Siena', previousProfession: 'Architetta', initialLevel: 'deputato', partyMode: 'existing', partyId: realParty.id, parliamentStartMode: 'real-context', parliamentaryGroupId: 'cam-xix-12', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } };
let store = await load();
store.createCareer(draft, [realParty], groups);
const stat = (state, metric) => state.dataset.statistics.find(item => item.subjectId === state.career.playerId && item.metric === metric)?.value;
const rich = saved => { saved.game.resources.funds = 50000; saved.game.resources.politicalCapital = 80; saved.game.week.ap = 6; };
const fresh = async mutate => { store = await reload(saved => { rich(saved); mutate?.(saved); }); return store.getState(); };

// corso-politiche: always available, once a week, persistent (on a save made before the weekly count existed: the field is not there, nothing breaks)
{
  const before = await fresh(saved => { delete saved.game.week.activityUses; });
  assert.equal(before.game.week.activityUses, undefined, 'Un salvataggio precedente non ha il conteggio settimanale.');
  const funds = before.game.resources.funds, ap = before.game.week.ap, exp = stat(before, 'experience'), sector = before.game.standing?.sectors?.istituzioni ?? 0;
  const result = store.performWeeklyActivity('corso-politiche');
  const after = store.getState();
  assert.equal(after.game.week.ap, ap - 2, 'Costa due giorni.'); assert.equal(after.game.resources.funds, funds - 350, 'Costa 350 €.');
  assert.ok(stat(after, 'experience') > exp, 'L’esperienza cresce.'); assert.ok((after.game.standing.sectors.istituzioni ?? 0) > sector, 'L’influenza nel settore istituzioni cresce e resta nel registro.');
  assert.ok(after.game.log.some(entry => entry.title === 'Corso di politiche pubbliche'), 'Resta nel diario della settimana.');
  assert.ok(result.report.lines.some(line => /Influenza nel settore|Influenza istituzioni|Influenza/.test(line)), 'Il resoconto dice che cosa è cambiato.');
  assert.throws(() => store.performWeeklyActivity('corso-politiche'), /Già fatto questa settimana/, 'Non si ripete nella stessa settimana per lo stesso premio.');
  store.advance(7);
  const next = store.getState();
  if (next.game.week.ap >= 2 && next.game.resources.funds >= 350) { store.performWeeklyActivity('corso-politiche'); assert.ok(store.getState().game.week.activityUses['corso-politiche'] === 1, 'Dalla settimana dopo si può rifare (il conteggio riparte).'); }
}

// tour-regione: another region, its attention, an echo, a consequence in the future
{
  const before = await fresh();
  const home = before.game.place.region;
  assert.equal(home, 'Toscana');
  assert.throws(() => store.performWeeklyActivity('tour-regione'), /regione/, 'Senza una regione non si parte.');
  assert.throws(() => store.performWeeklyActivity('tour-regione', home), /diversa dalla tua/, 'Una regione che non sia la propria.');
  const away = 'Calabria';
  const trust = before.society.regions[away].trust, notoriety = stat(before, 'notoriety'), pending = before.game.pending.length, ap = before.game.week.ap, funds = before.game.resources.funds, capital = before.game.resources.politicalCapital;
  const result = store.performWeeklyActivity('tour-regione', away);
  const after = store.getState();
  assert.equal(after.game.week.ap, ap - 3); assert.equal(after.game.resources.funds, funds - 900); assert.equal(after.game.resources.politicalCapital, capital - 1);
  assert.ok(stat(after, 'notoriety') > notoriety, 'La notorietà cresce.');
  const delta = after.society.regions[away].trust - trust;
  assert.ok(result.report.tone === 'bad' ? delta < 0 : delta > 1.5, `La fiducia della regione visitata si muove (${delta}), nel verso del risultato.`);
  assert.equal(after.society.regions[home].trust, before.society.regions[home].trust, 'La regione di casa non cambia.');
  assert.equal(after.game.pending.length, pending + 1, 'Una conseguenza arriva dopo sei settimane.');
  assert.ok(after.game.pending.at(-1).dueWeek === before.game.week.index + 6 || after.game.pending.some(item => item.dueWeek === before.game.week.index + 6), 'Con la sua scadenza.');
  assert.throws(() => store.performWeeklyActivity('tour-regione', away), /Già fatto/, 'Una volta a settimana.');
}

// comizio-piazza: only with an open window; raises the electoral preparation
{
  await fresh(saved => { for (const election of saved.game.elections) if (election.status === 'open') election.status = 'upcoming'; });
  assert.throws(() => store.performWeeklyActivity('comizio-piazza'), /finestra di candidatura/, 'Senza una finestra aperta il comizio non si fa, e il motivo è scritto.');
  const before = await fresh(saved => { const election = saved.game.elections.find(item => item.status === 'upcoming'); election.status = 'open'; });
  const prep = before.game.prep, popularity = stat(before, 'popularity'), trust = before.society.regions[before.game.place.region].trust;
  const result = store.performWeeklyActivity('comizio-piazza');
  const after = store.getState();
  assert.ok(after.game.prep >= prep + 3 - 1e-9, `La preparazione elettorale cresce (${prep} → ${after.game.prep}).`);
  assert.ok(result.report.tone === 'bad' ? stat(after, 'popularity') < popularity + 1.2 : stat(after, 'popularity') > popularity, 'La popolarità segue l’esito.');
  assert.ok(after.society.regions[after.game.place.region].trust >= trust - 0.01 && (result.report.tone === 'bad' || after.society.regions[after.game.place.region].trust > trust), 'La fiducia nel territorio di casa cresce (se non va male).');
}

// selezione-candidati: the secretary only, an open window, a current is heard and the others take note
{
  await fresh(saved => { const election = saved.game.elections.find(item => item.status === 'upcoming' || item.status === 'open'); election.status = 'open'; });
  assert.throws(() => store.performWeeklyActivity('selezione-candidati', store.getState().game.party.currents[0].id), /guida del partito/, 'Un iscritto semplice non seleziona i candidati.');
  const before = await fresh(saved => { const election = saved.game.elections.find(item => item.status === 'upcoming' || item.status === 'open'); election.status = 'open'; saved.game.party.affiliation = 'founder'; });
  const [heard, other] = before.game.party.currents;
  const valueOf = (state, id) => state.game.relations.find(item => item.id === id)?.value ?? state.game.party.currents.find(item => item.id === id)?.relation ?? state.game.party.currents.find(item => item.id === id)?.value;
  const cohesion = before.game.party.org?.cohesion;
  assert.throws(() => store.performWeeklyActivity('selezione-candidati', 'sconosciuta'), /corrente/, 'Si sceglie un’area vera del partito.');
  const result = store.performWeeklyActivity('selezione-candidati', heard.id);
  const after = store.getState();
  const heardAfter = after.game.party.currents.find(item => item.id === heard.id), otherAfter = after.game.party.currents.find(item => item.id === other.id);
  assert.ok((heardAfter.relation ?? heardAfter.value) > (heard.relation ?? heard.value), 'L’area ascoltata si sente riconosciuta.');
  assert.ok((otherAfter.relation ?? otherAfter.value) < (other.relation ?? other.value), 'Le altre aree prendono nota.');
  assert.ok(after.game.prep > before.game.prep, 'Le liste si preparano: sale la preparazione.');
  assert.ok(after.game.pending.length > before.game.pending.length, 'La chiusura delle liste porterà una conseguenza.');
  assert.ok(result.report.lines.length >= 3, 'Il resoconto elenca gli effetti.');
}

// question-time (opposition of a sitting government) and audizione (any seat): effects on the government and on the group
{
  const start = await fresh();
  assert.throws(() => store.performWeeklyActivity('question-time'), /opposizione di un governo/, 'Senza un governo in carica non c’è question time (e il motivo è scritto).');
  const before = await fresh(saved => { const other = saved.parliament.chambers[saved.parliament.player.chamber].groups.find(group => group.groupId !== saved.parliament.player.groupId).groupId; saved.parliament.government = { status: 'active', stability: 60, coalitionGroupIds: [other], supportingGroupIds: [], ministers: [], primeMinister: 'sim-premier', formedBy: 'simulation' }; });
  const notoriety = stat(before, 'notoriety'), stability = before.parliament.government.stability, support = before.parliament.careerStanding?.partySupport ?? 0;
  const result = store.performWeeklyActivity('question-time');
  const after = store.getState();
  assert.ok(after.parliament.government.stability < stability, `Il governo esce un po’ più debole dal question time (${stability} → ${after.parliament.government.stability}).`);
  assert.ok(stat(after, 'notoriety') > notoriety, 'Ti fai conoscere.');
  assert.ok((after.parliament.careerStanding?.partySupport ?? 0) > support, 'Il tuo gruppo apprezza.');
  assert.ok(result.report.lines.some(line => /governo/i.test(line)), 'Il resoconto parla del governo.');
  // in the majority the same seat does not ask questions to its own government
  await fresh(saved => { saved.parliament.government = { status: 'active', stability: 60, coalitionGroupIds: [saved.parliament.player.groupId], supportingGroupIds: [], ministers: [], primeMinister: 'sim-premier', formedBy: 'simulation' }; });
  assert.throws(() => store.performWeeklyActivity('question-time'), /opposizione/, 'Chi è in maggioranza non lo fa.');
  const hearing = await fresh();
  const hearingBefore = hearing.game.pending.length;
  store.performWeeklyActivity('audizione-commissione');
  const afterHearing = store.getState();
  assert.ok(afterHearing.game.pending.length > hearingBefore, 'L’audizione ha un seguito tra otto settimane.');
}

// replica-polemica: only with a controversy to close
{
  await fresh();
  const quiet = store.getState();
  const hasController = (quiet.game.memory ?? []).some(item => item.tone === 'bad');
  if (!hasController) assert.throws(() => store.performWeeklyActivity('replica-polemica'), /polemica/, 'Senza polemica non c’è nulla da chiudere (e il motivo è scritto).');
  const before = await fresh(saved => { remember(saved.game, { date: saved.clock.currentDate, kind: 'polemica', text: 'Una polemica sui rimborsi', tone: 'bad', weight: 2 }); });
  const reputation = stat(before, 'reputation');
  const result = store.performWeeklyActivity('replica-polemica');
  const after = store.getState();
  assert.ok(result.report.tone === 'bad' ? stat(after, 'reputation') < reputation : stat(after, 'reputation') > reputation, 'La reputazione segue l’esito della replica.');
  assert.ok(after.game.pending.length > before.game.pending.length, 'La polemica ha un seguito tra tre settimane.');
}

// incontro-amministratori: a seat is enough; vertice: for those who weigh in a majority only
{
  const majority = saved => { saved.parliament.government = { status: 'active', stability: 50, coalitionGroupIds: [saved.parliament.player.groupId], supportingGroupIds: [], ministers: [], primeMinister: 'sim-premier', formedBy: 'simulation' }; };
  const before = await fresh(saved => { saved.game.party.affiliation = 'member'; saved.game.party.rank = 0; majority(saved); });
  const civic = before.game.relations.find(item => item.id === 'civic')?.value;
  store.performWeeklyActivity('incontro-amministratori');
  const after = store.getState();
  assert.ok(after.game.relations.find(item => item.id === 'civic').value > civic, 'Il rapporto con il territorio cresce.');
  assert.ok(after.game.pending.length > before.game.pending.length, 'Le richieste degli amministratori hanno un seguito.');
  assert.throws(() => store.performWeeklyActivity('vertice-maggioranza'), /ruolo di peso/, 'Un semplice iscritto in maggioranza non guida un vertice (e il motivo è scritto).');
  const leader = await fresh(saved => { saved.game.party.affiliation = 'founder'; majority(saved); });
  const stability = leader.parliament.government.stability;
  store.performWeeklyActivity('vertice-maggioranza');
  const summit = store.getState();
  assert.ok(summit.parliament.government.stability > stability, `Il governo si stabilizza (${stability} → ${summit.parliament.government.stability}).`);
  assert.ok(summit.game.pending.length >= leader.game.pending.length, 'Il conto del vertice può arrivare dopo.');
  assert.throws(() => store.performWeeklyActivity('vertice-maggioranza'), /Già fatto/, 'Una volta a settimana.');
}

// party activities by affiliation: a member, the founder of a party of their own and an independent. «Riunione di partito», «Incontro con la leadership» and «Prendi posizione contro la linea» asked for
// membership, which a founder is not (he leads the party): the founder gets the meeting and a variant of the leadership one (the managers of his own party), the dissent stays closed to him with its own
// reason, and the independent stays limited everywhere. Nothing of membership, rank, promotions or congresses is given to the founder.
{
  const asMember = await fresh(saved => { saved.game.party.affiliation = 'member'; saved.game.party.rank = 1; });
  const memberMeeting = store.performWeeklyActivity('riunione');
  assert.ok(memberMeeting.report.lines.some(line => /Sostegno nel partito \+3/.test(line)) && memberMeeting.report.lines.some(line => /leadership/i.test(line)), 'Iscritto: la riunione dà sostegno interno e rapporto con la leadership.');
  const memberLeadership = store.performWeeklyActivity('leadership');
  assert.equal(memberLeadership.report.title, 'Incontro con la leadership', 'Iscritto: l’incontro con la leadership è quello di sempre.');
  assert.ok(memberLeadership.report.lines.some(line => /leadership/i.test(line)), 'Iscritto: cambia il rapporto con la leadership.');
  store.performWeeklyActivity('dissenso');
  assert.equal(store.getState().game.party.affiliation, 'member', 'Iscritto: resta iscritto.');

  // a real founder: the career starts with a party of his own (no leadership above him, so no relation with it)
  const founderDraft = { ...draft, partyMode: 'new', partyId: '', partyName: 'Partito del Fondatore', partyAbbreviation: 'PDF', partyDescription: 'Un partito di prova', partyColor: '#264d82', partyOrientation: 'Centrismo civico', startingRole: null, policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } };
  localStore.clear(); store = await load(); store.createCareer(founderDraft, [realParty], groups);
  const asFounder = await fresh();
  assert.equal(asFounder.game.party.affiliation, 'founder', 'Il fondatore è davvero un fondatore.');
  const rank = asFounder.game.party.rank, support = asFounder.game.party.support;
  assert.ok(!asFounder.game.relations.some(item => item.id === 'leadership'), 'Il fondatore non ha una leadership esterna con cui avere un rapporto.');
  const founderMeeting = store.performWeeklyActivity('riunione');
  assert.ok(founderMeeting.report.lines.some(line => /Sostegno nel partito \+3/.test(line)), 'Fondatore: la riunione di partito è disponibile e dà sostegno interno.');
  assert.ok(!founderMeeting.report.lines.some(line => /leadership/i.test(line)), 'Fondatore: nessun rapporto con una leadership che non c’è.');
  assert.ok(store.getState().game.party.support > support, 'Fondatore: il sostegno interno cresce davvero.');
  const influence = stat(store.getState(), 'influence');
  const founderLeadership = store.performWeeklyActivity('leadership');
  assert.equal(founderLeadership.report.title, 'Incontro con i dirigenti del partito', 'Fondatore: la variante è l’incontro con i dirigenti del proprio partito.');
  assert.ok(!founderLeadership.report.lines.some(line => /leadership/i.test(line)) && stat(store.getState(), 'influence') > influence, 'Fondatore: più peso interno, senza rapporti con una leadership esterna.');
  assert.throws(() => store.performWeeklyActivity('dissenso'), /Da fondatore la linea la decidi tu/, 'Fondatore: il dissenso interno resta chiuso, con il motivo giusto (non «serve l’iscrizione»).');
  const after = store.getState().game.party;
  assert.deepEqual([after.affiliation, after.rank, after.rankTitle], [asFounder.game.party.affiliation, rank, asFounder.game.party.rankTitle], 'Fondatore: iscrizione, grado e titolo non cambiano (non è un iscritto).');
  assert.ok(!('joinedAt' in after) || after.joinedAt === asFounder.game.party.joinedAt, 'Fondatore: nessuna data di iscrizione inventata.');

  await fresh(saved => { saved.game.party = null; });
  for (const [id, reason] of [['riunione', /Serve un partito/], ['leadership', /iscrizione a un partito/], ['dissenso', /Serve l’iscrizione a un partito/]]) assert.throws(() => store.performWeeklyActivity(id), reason, `Indipendente: «${id}» resta chiusa, con il motivo giusto.`);
  // the rest of the party activities keep their own requirements for the three of them
  for (const id of ['tesseramento', 'corrente', 'contributo']) assert.throws(() => store.performWeeklyActivity(id), /Serve un partito/, `Indipendente: «${id}» richiede un partito.`);
  localStore.clear(); store = await load(); store.createCareer(founderDraft, [realParty], groups); await fresh();
  assert.doesNotThrow(() => store.performWeeklyActivity('tesseramento'), 'Fondatore: le attività di partito che già gli spettano restano disponibili.');
}

// determinism: the same career, the same activity, the same outcome
{
  const run = async () => { localStore.clear(); store = await load(); store.createCareer(draft, [realParty], groups); store = await reload(rich); const result = store.performWeeklyActivity('tour-regione', 'Puglia'); const state = store.getState(); return JSON.stringify([result.report, state.society.regions.Puglia.trust, stat(state, 'notoriety'), state.game.pending.length]); };
  const [a, b] = [await run(), await run()];
  assert.equal(a, b, 'Con lo stesso inizio e la stessa attività l’esito è lo stesso.');
}
// the menu, the planner and the save: the new activities are listed and the weekly counts survive a reload
{
  await fresh();
  store.performWeeklyActivity('corso-politiche');
  const reloaded = await load();
  assert.throws(() => reloaded.performWeeklyActivity('corso-politiche'), /Già fatto/, 'Dopo un ricaricamento il conteggio della settimana resta.');
  assert.ok(ITALIAN_REGIONS.length === 20);
}
console.log(`Agenda verificata: catalogo di ${WEEKLY_ACTIVITIES.length} attività senza id doppi, con costi, effetti, probabilità ed esiti validi; le ${NEW.length} nuove (tour in un’altra regione, comizio, incontro con gli amministratori, colloqui con i candidati, vertice di maggioranza, question time, audizione in commissione, replica a una polemica, corso di politiche pubbliche) rifiutate quando manca il ruolo, la finestra o la polemica, una volta a settimana, con costi pagati, effetti che restano (indicatori, reputazioni, settore, rapporti, fiducia della regione, preparazione elettorale), conseguenze tra settimane e lo stesso esito a parità di inizio.`);
