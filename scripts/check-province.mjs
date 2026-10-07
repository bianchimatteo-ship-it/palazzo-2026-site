// La Provincia come livello della carriera: dove esiste (province, città metropolitane e liberi consorzi con organi propri; non la
// Valle d’Aosta, le province autonome di Trento e Bolzano né le ex province del Friuli-Venezia Giulia), come si comincia (il seggio
// provinciale pende da quello nel comune), il consiglio e la sua presidenza (strade, scuole, pianificazione; niente tributi), il voto
// di secondo livello (votano sindaci e consiglieri), il calendario, i vecchi salvataggi, le candidature e il legame con il Comune.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { CAREER_LEVELS, PROVINCIAL_LEVEL_PROBLEM, PROVINCIAL_UNIT_TYPES, hasProvincialLevel, initialCareerStatistics } = await module('src/data/regions.js');
const L = await module('src/core/local-engine.js');
const A = await module('src/data/simulation/local-acts.js');
const C = await module('src/core/career-engine.js');
const { ELECTION_MODELS } = await module('src/data/simulation/campaign-rules.js');
const { validateCareerStep } = await module('src/core/career-rules.js');
const { makeCareerDraft, renderCareerWizard } = await module('src/ui/career-wizard.js');
const { renderInstitutions } = await module('src/ui/local-mode.js');
const { renderCampaignPage } = await module('src/ui/campaign-mode.js');
const { playerRoles, heldOfficesOf } = await module('src/core/roles.js');
const { seededRandom } = await module('src/core/vote-engine.js');
const { advanceDays } = await module('src/core/time.js');
const { checkInvariants } = await module('src/core/invariants.js');
const R = await module('src/core/seat-roster.js');
const clean = (html, where) => { const bad = html.replace(/data-[a-z-]+="[^"]*"/g, '').match(/.{0,60}(undefined|NaN|\[object Object\]|Infinity).{0,60}/); assert.ok(!bad, `${where}: valori non validi (${bad?.[0]})`); };
const noIssues = (state, where) => { const result = checkInvariants(state); assert.ok(result.ok, `${where}: invarianti ${JSON.stringify(result.issues?.slice(0, 3))}`); };
const BIRTH = '1975-04-03';

// ---------- 1. dove la Provincia esiste ----------
const first = await startCareer({ seed: 'provincia-dati', level: 'comunale' });
// The ISTAT list of the comuni is a real collection of its own: the long-run harness does not need it, the wizard does.
const realData = await module('src/data/repositories/real-data.js');
await realData.loadRealCollections(['territorialUnits', 'municipalities']);
const db = { ...first.db, municipalities: realData.realDatabase.municipalities, territorialUnits: realData.realDatabase.territorialUnits };
{
  assert.ok(CAREER_LEVELS.provinciale && CAREER_LEVELS.provinciale.institution === 'provincia' && CAREER_LEVELS.provinciale.requiresComune, 'La Provincia è un livello della carriera, con il seggio nel comune');
  assert.deepEqual(PROVINCIAL_UNIT_TYPES, ['Provincia', 'Città metropolitana', 'Libero consorzio di comuni']);
  const base = initialCareerStatistics('provinciale');
  assert.ok(base.influence > initialCareerStatistics('comunale').influence && base.influence < initialCareerStatistics('regionale').influence && base.experience > initialCareerStatistics('comunale').experience, 'Il livello provinciale sta tra il comunale e il regionale');
  const counts = {};
  for (const unit of db.territorialUnits) { const key = `${unit.type}|${hasProvincialLevel({ region: unit.gameRegion, provinceCode: unit.code, provinceType: unit.type })}`; counts[key] = (counts[key] ?? 0) + 1; }
  assert.equal(counts['Città metropolitana|true'], 15, 'Le 15 città metropolitane');
  assert.equal(counts['Libero consorzio di comuni|true'], 6, 'I 6 liberi consorzi');
  assert.equal(counts['Provincia|true'], 82, 'Le province con organi propri (senza la Valle d’Aosta)');
  assert.equal(counts['Provincia autonoma|false'], 2, 'Trento e Bolzano hanno i poteri di una Regione');
  assert.equal(counts['Unità non amministrativa|false'], 4, 'Le ex province del Friuli-Venezia Giulia non hanno organi');
  assert.equal(counts['Provincia|false'], 1, 'La Valle d’Aosta non ha una provincia');
  assert.equal(hasProvincialLevel({ region: 'Toscana', provinceCode: null }), false, 'Senza un’unità territoriale non c’è una provincia');
  // Il wizard: la carta c’è, e si spegne dove la provincia non ha organi.
  const territory = { units: db.territorialUnits, municipalities: db.municipalities, sourceUrl: db.manifest.territorialSource.url, sourceName: db.manifest.territorialSource.name };
  const state = first.store.getState();
  const render = code => { const municipality = db.municipalities.find(item => item.code === code); const unit = db.territorialUnits.find(item => item.code === municipality.unit); return renderCareerWizard(state, { ...makeCareerDraft('2026-09-24'), step: 2, region: unit.gameRegion, municipality: municipality.name, municipalityCode: code, provinceCode: unit.code, provinceName: unit.name, provinceType: unit.type, initialLevel: 'provinciale' }, [], () => null, db.parliamentaryGroups, [], [], db.politicians, territory); };
  const siena = render('052032');
  clean(siena, 'wizard Siena');
  assert.ok(/PROVINCIALE/.test(siena) && /data-level="provinciale"/.test(siena) && !/data-level="provinciale"[^>]*disabled/.test(siena), 'A Siena la carta della Provincia è attiva');
  for (const [code, label] of [['021008', 'Bolzano'], ['022205', 'Trento'], ['007003', 'Aosta'], ['032006', 'Trieste']]) {
    const html = render(code);
    assert.ok(/data-level="provinciale"[^>]*disabled/.test(html) && html.includes(PROVINCIAL_LEVEL_PROBLEM.slice(0, 40)), `${label}: la carta della Provincia è spenta e dice perché`);
  }
  // E il passaggio non si supera con un comune senza provincia.
  const problem = (code, level = 'provinciale') => { const municipality = db.municipalities.find(item => item.code === code); const unit = db.territorialUnits.find(item => item.code === municipality.unit); return validateCareerStep({ ...makeCareerDraft('2026-09-24'), region: unit.gameRegion, municipalityCode: code, provinceCode: unit.code, provinceType: unit.type, initialLevel: level }, 2, [], db.parliamentaryGroups); };
  assert.deepEqual(problem('052032'), [], 'Siena: il percorso provinciale è valido');
  assert.ok(problem('021008').includes(PROVINCIAL_LEVEL_PROBLEM), 'Bolzano: nessun percorso provinciale');
  assert.deepEqual(problem('021008', 'comunale'), [], 'ma il comune resta una partenza valida');
}

// ---------- 2. le istituzioni e gli atti della Provincia ----------
{
  assert.ok(L.INSTITUTIONS.provincia.secondLevel && L.INSTITUTIONS.provincia.leader === 'Presidente della Provincia' && L.INSTITUTIONS.provincia.portfolios.length === 6, 'Il consiglio provinciale: un Presidente e consiglieri delegati');
  assert.ok(!L.localAreas('provincia').includes('sanita') && L.localAreas('provincia').includes('scuola') && L.localAreas('provincia').includes('infrastrutture'), 'La Provincia ha strade e scuole, non la sanità');
  const types = A.ACT_TYPES.provincia.map(type => type.id);
  assert.ok(['opere', 'ptcp', 'convenzione', 'decreto-presidente', 'mozione', 'bilancio'].every(id => types.includes(id)), `Atti propri della Provincia (${types.join(', ')})`);
  assert.ok(!types.includes('tributi') && types.includes('statuto'), 'Niente tributi propri di peso; lo statuto invece c’è (legge 56/2014)');
  assert.ok(A.PROVINCE_SHARE_OF_REGION > 0 && A.PROVINCE_SHARE_OF_REGION < 1, 'Gli effetti sul territorio sono una parte di quelli della Regione');
  assert.ok(A.ACT_TYPES.provincia.every(type => type.organ && type.quorum && type.iter?.length && type.function && type.approved && type.rejected), 'Ogni atto spiega a cosa serve, chi decide e cosa succede');
  const groups = [{ id: 'a', label: 'A', axis: -1, seats: 5, side: 'maggioranza' }, { id: 'b', label: 'B', axis: 1, seats: 4, side: 'opposizione' }, { id: 'c', label: 'C', axis: 0, seats: 3, side: 'maggioranza' }];
  let inst = L.createInstitution({ kind: 'provincia', name: 'Provincia di prova', region: 'Toscana', date: '2026-09-27', role: 'consigliere', side: 'maggioranza', playerGroupId: 'c', leaderGroupId: 'a', groups });
  assert.equal(inst.seats, 12);
  assert.equal(inst.executive.members.length, 6, 'Sei deleghe provinciali');
  const territory = { infrastrutture: 45, trasporti: 45, istruzione: 45, ambiente: 50, servizi: 50, sicurezza: 50, sanita: 50, economia: 50 };
  const rand = seededRandom('provincia');
  let date = '2026-09-27', effects = 0, votes = 0, ratio = null;
  for (let week = 0; week < 60; week++) {
    date = advanceDays(date, 7);
    const out = L.advanceInstitutionWeek(inst, { date, rand, territory });
    inst = out.inst;
    for (const event of out.events) {
      if (event.type === 'atto-votato') votes++;
      if (event.type === 'effetti' && event.kind === 'provincia') { effects++; const total = Object.values(event.indicators).reduce((sum, value) => sum + Math.abs(value), 0); assert.ok(total > 0 && total < 4, `Effetti di area vasta (${total})`); ratio = total; }
    }
    if (inst.status !== 'active') break;
  }
  assert.ok(votes >= 4, `Il consiglio provinciale lavora: ${votes} atti votati in 60 settimane`);
  assert.ok(effects >= 1 && ratio !== null, 'Gli atti approvati arrivano al territorio (strade, scuole)');
  assert.ok(inst.acts.concat(inst.archive).some(act => ['opere', 'ptcp', 'convenzione', 'piano', 'decreto-presidente', 'mozione'].includes(act.category)), 'Atti provinciali veri');
}

// ---------- 3. la carriera provinciale sul motore vero ----------
const places = [
  { label: 'Siena (provincia)', draft: {}, region: 'Toscana', name: /^Provincia di Siena$/ },
  { label: 'Firenze (città metropolitana)', draft: { region: 'Toscana', municipality: 'Firenze', municipalityCode: '048017', provinceCode: '048', provinceName: 'Firenze', provinceType: 'Città metropolitana' }, region: 'Toscana', name: /^Città metropolitana di Firenze$/ },
  { label: 'Ragusa (libero consorzio)', draft: { region: 'Sicilia', municipality: 'Ragusa', municipalityCode: '088009', provinceCode: '088', provinceName: 'Ragusa', provinceType: 'Libero consorzio di comuni' }, region: 'Sicilia', name: /^Libero consorzio comunale di Ragusa$/ }
];
for (const place of places) {
  const run = await startCareer({ seed: `provincia-${place.label}`, level: 'provinciale', region: place.region === 'Toscana' ? 'Toscana' : null, draft: { birthDate: BIRTH, ...(place.label.startsWith('Siena') ? { region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', provinceCode: '052', provinceName: 'Siena', provinceType: 'Provincia' } : place.draft) } });
  const s = run.store.getState();
  assert.equal(s.career.initialLevel, 'provinciale');
  const kinds = s.local.institutions.filter(inst => inst.status === 'active').map(inst => inst.kind).sort();
  assert.deepEqual(kinds, ['comune', 'provincia'], `${place.label}: si parte con il seggio nel comune e quello in provincia`);
  const provincia = s.local.institutions.find(inst => inst.kind === 'provincia');
  assert.match(provincia.name, place.name, `${place.label}: il nome dell’ente`);
  assert.ok(provincia.seats >= 12 && provincia.seats <= 16, `${place.label}: un consiglio di una dozzina di seggi (${provincia.seats})`);
  assert.ok(provincia.until && provincia.until > s.clock.currentDate, `${place.label}: il mandato dura fino al voto provinciale (${provincia.until})`);
  assert.deepEqual(s.dataset.offices.filter(item => !item.endDate).map(item => item.level).sort(), ['comunale', 'provinciale'], `${place.label}: due incarichi in corso`);
  assert.ok(s.dataset.territories.some(item => item.kind === 'provincia' && item.istatCode === (place.draft.provinceCode ?? '052')), `${place.label}: la provincia è un territorio della carriera`);
  assert.equal(s.game.place.provinceType, place.draft.provinceType ?? 'Provincia', `${place.label}: il tipo di ente è registrato`);
  const vote = s.game.elections.find(item => item.type === 'provinciale');
  assert.ok(vote && vote.status === 'upcoming' && vote.label.includes(place.draft.provinceName ?? 'Siena') && vote.electionDate > s.clock.currentDate, `${place.label}: il voto provinciale è in calendario (${vote?.electionDate})`);
  assert.deepEqual(heldOfficesOf(s), ['consigliere-provinciale', 'consigliere-comunale']);
  assert.ok(playerRoles(s).roles.some(([, label]) => label === 'Consigliere provinciale'), `${place.label}: il ruolo è tra quelli del giocatore`);
  const html = renderInstitutions(s);
  clean(html, `${place.label}: istituzioni`);
  assert.ok(html.includes('id="istituzione-provincia"') && html.includes('Consiglio provinciale') && html.includes('Stato del territorio provinciale') && !html.includes('data-local-tax'), `${place.label}: la scheda della Provincia non ha tributi`);
  // Seats with people: the provincial council (and the comune's) has one simulated person for each seat, the player's in his group.
  for (const inst of s.local.institutions.filter(item => item.status === 'active')) {
    const seats = R.rosterSeats(inst.roster);
    assert.equal(seats.length, inst.seats, `${place.label}: ${inst.name}, un seggio per persona`);
    assert.equal(new Set(seats.map(seat => seat.personId)).size, seats.length, `${place.label}: ${inst.name}, nessuna persona due volte`);
    assert.equal(seats.filter(seat => seat.origin === 'player').length, inst.playerGroupId ? 1 : 0, `${place.label}: ${inst.name}, il giocatore siede una volta`);
    assert.ok(seats.filter(seat => seat.origin !== 'player').every(seat => { const person = s.dataset.politicians.find(item => item.id === seat.personId); return person?.source === 'simulation' && person.origin === 'seggio' && person.region === inst.region; }), `${place.label}: ${inst.name}, persone della simulazione del territorio`);
  }
  assert.ok(R.rosterSeats(provincia.roster).some(seat => seat.leader) && s.dataset.politicians.some(item => /^Consigliere provinciale simulato n\. \d+ · /.test(item.displayName ?? '')), `${place.label}: il consiglio provinciale ha i suoi consiglieri e il presidente simulato`);
  const dots = html.match(/<circle class="hemi-seat[^>]*data-local-seat="[^"]+"/g) ?? [];
  assert.equal(dots.length, s.local.institutions.filter(item => item.status === 'active').reduce((sum, inst) => sum + inst.seats, 0), `${place.label}: un punto per ogni seggio dei due consigli`);
  noIssues(s, place.label);
}

// ---------- 4. il calendario e i vecchi salvataggi ----------
{
  const run = await startCareer({ seed: 'provincia-calendario', level: 'provinciale' });
  const { store } = run;
  let s = store.getState();
  const entry = s.game.elections.find(item => item.type === 'provinciale');
  assert.ok(entry.windowOpensAt < entry.electionDate && entry.windowClosesAt > entry.windowOpensAt, 'Finestra delle candidature e voto');
  assert.equal(ELECTION_MODELS.provinciale.seatCount, 12);
  // Un vecchio salvataggio (di prima della Provincia) la riceve alla prima apertura, una volta sola, e solo dove la provincia ha organi.
  const legacy = JSON.parse(JSON.stringify(s));
  legacy.game.elections = legacy.game.elections.filter(item => item.type !== 'provinciale');
  delete legacy.game.flags.provincialCalendar;
  const migrated = C.addProvincialCalendar(legacy.game, { region: 'Toscana', municipality: 'Siena', provinceCode: '052', provinceName: 'Siena', provinceType: 'Provincia' }, null, legacy.clock.currentDate);
  assert.equal(migrated.elections.filter(item => item.type === 'provinciale').length, 1, 'Il voto provinciale entra nel calendario');
  assert.equal(migrated.flags.provincialCalendar, 1);
  assert.equal(C.addProvincialCalendar(migrated, { region: 'Toscana', provinceCode: '052', provinceType: 'Provincia' }, null, legacy.clock.currentDate).elections.filter(item => item.type === 'provinciale').length, 1, 'Una volta sola');
  const none = C.addProvincialCalendar({ ...legacy.game, flags: {} }, { region: 'Trentino-Alto Adige', provinceCode: '021', provinceType: 'Provincia autonoma' }, null, legacy.clock.currentDate);
  assert.ok(!none.elections.some(item => item.type === 'provinciale') && none.flags.provincialCalendar === 1, 'Dove la provincia non ha organi nessun voto provinciale');
  // Caricando una partita vecchia il calendario si aggiorna da solo.
  store.loadGame(legacy);
  s = store.getState();
  assert.ok(s.game.elections.some(item => item.type === 'provinciale' && item.status === 'upcoming'), 'La partita caricata riceve il voto provinciale');
  noIssues(s, 'partita migrata');
  // Il ciclo: dopo il voto il prossimo è tra quattro anni circa.
  for (let i = 0; i < 90 && !store.getState().game.elections.some(item => item.type === 'provinciale' && item.status === 'open'); i++) store.advance(7);
  s = store.getState();
  assert.ok(s.game.elections.some(item => item.type === 'provinciale' && item.status === 'open'), 'La finestra provinciale si apre');
}

// ---------- 5. il voto di secondo livello e il legame con il Comune ----------
{
  const run = await startCareer({ seed: 'provincia-voto', level: 'provinciale' });
  const { store } = run;
  let s = store.getState();
  while (!s.game.elections.some(item => item.type === 'provinciale' && item.status === 'open')) { store.advance(7); s = store.getState(); if (s.game.week.index > 200) break; }
  assert.ok(s.game.elections.some(item => item.type === 'provinciale' && item.status === 'open'), 'Si apre la finestra provinciale');
  if (s.campaign?.status === 'active') store.clearCampaign();
  const config = role => ({ electionType: 'provinciale', role, objective: 'seat' });
  const args = [db.parties, { politicians: db.politicians, groups: db.parliamentaryGroups }];
  assert.throws(() => store.startCampaign(config('presidente'), ...args), /sindaco/i, 'La presidenza è per i sindaci');
  const page = renderCampaignPage(store.getState(), [], () => null, { 'setup.electionType': 'provinciale' });
  clean(page, 'campagna provinciale');
  assert.ok(/Provinciale: elezione di secondo livello/.test(page) && /Presidente della Provincia · non disponibile/.test(page) && /Consigliere provinciale/.test(page), 'La pagina della campagna spiega che chi vota sono gli amministratori e che la presidenza non è disponibile');
  store.startCampaign(config('consigliere'), ...args);
  s = store.getState();
  const campaign = s.campaign;
  assert.equal(campaign.electionType, 'provinciale');
  assert.deepEqual(campaign.territories.map(area => area.kind), ['fascia-comuni-simulata', 'fascia-comuni-simulata', 'fascia-comuni-simulata'], 'L’elettorato sono fasce di comuni, pesate per popolazione');
  assert.equal(campaign.territories.reduce((sum, area) => sum + area.weight, 0), 100);
  assert.ok(campaign.candidates.length >= 3 && campaign.candidates.length <= 5, 'Poche liste in campo');
  for (let i = 0; i < 12 && store.getState().campaign?.status === 'active'; i++) {
    for (const event of [...(store.getState().campaign.pendingEvents ?? [])]) { try { store.decideCampaignEvent(event.id, event.choices[0].id); } catch { /* done */ } }
    try { store.performCampaignActivity('party_meeting', { territoryId: store.getState().campaign.territories[0].id }); } catch { /* not affordable */ }
    store.advance(7);
  }
  s = store.getState();
  const result = s.career.lastElectionResult;
  assert.ok(result && result.electionType === 'provinciale', 'Il voto provinciale è chiuso e ha un esito');
  // Qualunque esito: la Provincia non sopravvive senza il Comune.
  const active = kind => s.local.institutions.some(inst => inst.kind === kind && inst.status === 'active');
  assert.ok(!active('provincia') || active('comune'), 'Il seggio provinciale pende da quello comunale');
  if (result.personalMandate) assert.ok(active('provincia') && s.local.institutions.filter(inst => inst.kind === 'provincia').length >= 2, 'Eletto: nuovo consiglio provinciale, il precedente è concluso');
  else assert.ok(!active('provincia'), 'Non eletto: il seggio provinciale si chiude');
  // Seats with people after the vote: the council that closed keeps no seats, its people leave the registry unless another office refers to them, the new one is seated.
  const sitting = s.local.institutions.filter(inst => inst.status === 'active');
  for (const inst of sitting) assert.equal(R.rosterSize(inst.roster), inst.seats, `${inst.name}: i seggi hanno tutti la loro persona dopo il voto`);
  assert.ok(s.local.institutions.filter(inst => inst.status !== 'active').every(inst => !inst.roster), 'I consigli conclusi non tengono i seggi.');
  const live = new Set(sitting.flatMap(inst => R.rosterPeople(inst.roster)));
  assert.ok(s.dataset.politicians.filter(item => item.origin === 'seggio').every(item => live.has(item.id)), 'Le persone dei consigli conclusi escono dal registro: restano solo quelle che siedono.');
  noIssues(s, 'dopo il voto provinciale');
}

// ---------- 6. il Presidente della Provincia ----------
{
  const run = await startCareer({ seed: 'provincia-presidente', level: 'provinciale' });
  const { store } = run;
  const s = JSON.parse(JSON.stringify(store.getState()));
  s.local.institutions = s.local.institutions.map(inst => ({ ...inst, playerRole: inst.kind === 'comune' ? 'sindaco' : 'presidente', executive: { ...inst.executive, leader: 'player' } }));
  store.loadGame(s);
  const state = store.getState();
  assert.deepEqual(heldOfficesOf(state), ['sindaco', 'presidente-provincia']);
  const roles = playerRoles(state);
  assert.ok(roles.roles.some(([, label]) => /^Presidente della Provincia di /.test(label)), 'Il ruolo: Presidente della Provincia');
  assert.ok(roles.powers.find(power => /Assemblea dei sindaci/.test(power.label))?.enabled, 'Il Presidente guida l’Assemblea dei sindaci');
  assert.ok(roles.powers.find(power => /^Giunta, assessori/.test(power.label))?.enabled && !roles.powers.find(power => /Tributi locali/.test(power.label)) === false, 'Compone la giunta; i tributi sono del Comune');
  const html = renderInstitutions(state);
  clean(html, 'presidente della Provincia');
  assert.ok(/Presidente della Provincia · guidi/.test(html) && /Guidi l’esecutivo/.test(html), 'La scheda dice che guidi l’ente');
  // Da presidente si propongono gli atti dell’esecutivo; le aliquote no (non le ha).
  const inst = state.local.institutions.find(item => item.kind === 'provincia');
  const proposed = store.proposeLocalAct(inst.id, 'infrastrutture', 'opere');
  assert.ok(proposed.acts.some(act => act.category === 'opere' && act.sponsor.kind === 'executive'), 'Il Presidente propone opere');
  assert.throws(() => store.setLocalTaxLevel(inst.id, 'alta'), /aliquot|tribut|esecutivo/i, 'La Provincia non decide aliquote');
  noIssues(store.getState(), 'presidente della Provincia');
}

console.log('Provincia verificata: livello della carriera dove la provincia ha organi (103 enti su 110, non Aosta, Trento, Bolzano e le ex province del Friuli-Venezia Giulia), partenza con il seggio nel comune, consiglio e presidenza con atti, deleghe ed effetti propri (senza tributi), voto di secondo livello con candidature per ruolo, calendario e vecchi salvataggi, legame con il Comune, consigli con una persona simulata per seggio (liberati a mandato chiuso).');
