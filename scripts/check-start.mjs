// Come inizia una carriera, oltre al livello: l’eurodeputato, l’outsider, i debiti politici, il partito già diviso, la
// carriera già consolidata e lo scenario personalizzato. Sono condizioni vere, non etichette: cambiano relazioni,
// risorse, vincoli, opportunità, consenso e sviluppo della carriera, e continuano a produrre conseguenze (richieste
// dei creditori, un apparato che mette alla prova l’outsider, aree in guerra, nemici, un passato che torna, attese da
// rispettare). Qui: regole e punti, wizard (passaggi 2, 4 e 5), partenze sul motore vero, conseguenze nel tempo,
// effetti su promozioni, candidature e campagne, vecchi salvataggi, invarianti e pagine.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const S = await module('src/core/start-engine.js');
const R = await module('src/data/simulation/start-rules.js');
const { STARTING_OFFICES, STARTING_ROLES, validateCareerStep, validateNewCareerDraft } = await module('src/core/career-rules.js');
const { makeCareerDraft, renderCareerWizard } = await module('src/ui/career-wizard.js');
const { CAREER_LEVELS, careerLevelLabel } = await module('src/data/regions.js');
const { playerRoles } = await module('src/core/roles.js');
const { checkInvariants } = await module('src/core/invariants.js');
const { careerOverview } = await module('src/core/career-overview.js');
const { renderCareerPage } = await module('src/ui/career-page.js');
const { classifyOutcome } = await module('src/core/election-engine.js');
const { normalizeGameState } = await module('src/core/career-engine.js');
const { advancementOdds, progressionFactors } = await module('src/core/progression-engine.js');
const lines = [];
const clean = (html, where) => { const bad = html.replace(/data-[a-z-]+="[^"]*"/g, '').match(/.{0,60}(undefined|NaN|\[object Object\]|Infinity).{0,60}/); assert.ok(!bad, `${where}: valori non validi (${bad?.[0]})`); };
const noIssues = (state, where) => { const result = checkInvariants(state); assert.ok(result.ok, `${where}: invarianti violate ${JSON.stringify(result.issues.slice(0, 3))}`); };
const statOf = (s, metric) => s.dataset.statistics.find(item => item.subjectId === s.career.playerId && item.metric === metric)?.value;
const relation = (s, id) => s.game.relations.find(item => item.id === id)?.value;
const inboxIds = s => s.game.inbox.map(item => item.templateId);
const BIRTH = '1975-04-03';

// ---------- 1. le regole: leve, punti, esclusioni, età ----------
{
  assert.equal(R.START_BUDGET, 6);
  assert.deepEqual(R.START_PROFILE_ORDER, ['ordinaria', 'outsider', 'debiti', 'partito-diviso', 'consolidata', 'personalizzato'], 'Sei modi di iniziare, compreso lo scenario personalizzato');
  assert.equal(new Set(R.START_LEVERS.map(lever => lever.id)).size, R.START_LEVERS.length, 'Leve con id unici');
  assert.ok(R.START_LEVERS.every(lever => R.LEVER_EFFECTS[lever.id] && (lever.kind === 'vantaggio' ? lever.cost > 0 : lever.gain > 0)), 'Ogni leva ha i suoi effetti e costa (vantaggio) o dà (zavorra) dei punti');
  for (const id of R.START_PROFILE_ORDER.filter(id => !R.START_PROFILES[id].custom)) {
    const plan = S.startPlan({ profile: id }, { partyMode: 'existing' });
    assert.ok(plan.points.balance >= 0, `${id}: il punteggio non è in rosso (${plan.points.balance})`);
    assert.deepEqual(S.startProblems({ profile: id }, { partyMode: 'existing' }), [], `${id}: partenza valida con un partito`);
    assert.ok(Object.keys(plan.levels).every(lever => R.LEVER_BY_ID[lever]), `${id}: solo leve note`);
  }
  assert.equal(S.startPlan({ profile: 'consolidata' }, { partyMode: 'existing' }).points.balance, 0, 'La carriera consolidata spende esattamente i suoi punti');
  assert.deepEqual(S.startPlan({ profile: 'ordinaria' }).levels, {}, 'L’inizio ordinario non cambia nulla');
  // I punti: i vantaggi costano, le zavorre restituiscono.
  assert.deepEqual(S.startBalance({ esperienza: 1, rete: 1 }), { free: 6, spent: 4, gained: 0, balance: 2 });
  assert.equal(S.startBalance({ debiti: 3 }).balance, 12);
  assert.ok(S.startProblems({ profile: 'personalizzato', levels: { esperienza: 3, rete: 3 } }).some(text => /in rosso/.test(text)), 'Uno scenario in rosso non è valido');
  assert.deepEqual(S.startProblems({ profile: 'personalizzato', levels: { esperienza: 1, rete: 1 } }), [], 'Uno scenario in pari o in attivo è valido');
  // Esclusioni: un outsider non ha un protettore né una lunga carriera politica.
  assert.ok(S.startProblems({ profile: 'personalizzato', levels: { outsider: 2, sostegno: 1 } }, { partyMode: 'existing' }).some(text => /protettore/.test(text)), 'Outsider e sostegno nel partito non si abbinano');
  assert.ok(S.startProblems({ profile: 'personalizzato', levels: { outsider: 1, esperienza: 3 } }, { partyMode: 'existing' }).some(text => /esperienza/.test(text)), 'Outsider e lunga esperienza non si abbinano');
  // Il partito diviso richiede un partito esistente; senza, le leve di partito non possono esistere.
  assert.ok(S.startProblems({ profile: 'partito-diviso' }, { partyMode: 'independent' }).length > 0, 'Il partito diviso richiede un partito');
  assert.ok(S.startProblems({ profile: 'partito-diviso' }, { partyMode: 'new' }).length > 0, 'Né vale per un partito fondato da te');
  const dropped = S.effectiveLevels({ profile: 'personalizzato', levels: { sostegno: 2, 'partito-diviso': 1, rete: 1 } }, { partyMode: 'independent' });
  assert.deepEqual([dropped.levels, dropped.dropped.sort()], [{ rete: 1 }, ['partito-diviso', 'sostegno']], 'Senza partito esistente cadono le leve che lo richiedono');
  // L’età: l’esperienza si ha avendo vissuto abbastanza.
  assert.ok(S.startAgeProblems({ profile: 'consolidata' }, { partyMode: 'existing', birthDate: '1995-01-01', date: '2026-09-24' }).length > 0, 'Una carriera consolidata a 31 anni non è credibile');
  assert.deepEqual(S.startAgeProblems({ profile: 'consolidata' }, { partyMode: 'existing', birthDate: BIRTH, date: '2026-09-24' }), [], 'A 51 anni sì');
  assert.ok(S.startAgeProblems({ profile: 'personalizzato', levels: { esperienza: 1 } }, { birthDate: '2000-01-01', date: '2026-09-24' }).length > 0, 'Il primo livello di esperienza richiede 30 anni: a 26 no');
  assert.deepEqual(S.startAgeProblems({ profile: 'personalizzato', levels: { esperienza: 1 } }, { birthDate: '1995-01-01', date: '2026-09-24' }), [], 'A 31 anni sì');
  assert.equal(S.ageOn('1975-04-03', '2026-04-02'), 50, 'Età: il compleanno non è ancora arrivato');
  assert.equal(S.ageOn('1975-04-03', '2026-04-03'), 51);
  // La scelta del wizard.
  const asCustom = S.chooseStart({ profile: 'outsider', levels: {} }, { profile: 'personalizzato' });
  assert.deepEqual(asCustom, { profile: 'personalizzato', levels: R.START_PROFILES.outsider.levels }, 'Lo scenario personalizzato parte dal modo di iniziare appena lasciato');
  assert.deepEqual(S.chooseStart({ profile: 'outsider' }, { lever: 'rete', delta: 1 }).levels.rete, 2, 'Modificare una leva trasforma la partenza in scenario personalizzato');
  assert.equal(S.chooseStart({ profile: 'personalizzato', levels: { rete: 3 } }, { lever: 'rete', delta: 1 }).levels.rete, 3, 'Livello massimo 3');
  assert.ok(!('rete' in S.chooseStart({ profile: 'personalizzato', levels: { rete: 1 } }, { lever: 'rete', delta: -1 }).levels), 'A zero la leva sparisce');
  assert.deepEqual(S.chooseStart({ profile: 'outsider' }, { profile: 'inventato' }), { profile: 'outsider', levels: R.START_PROFILES.outsider.levels }, 'Un profilo sconosciuto non cambia nulla');
  // Il testo di ogni leva nasce dai numeri che il motore applica.
  for (const lever of R.START_LEVERS) for (const level of [1, 2, 3]) {
    const text = S.leverLines(lever.id, level).join(' ');
    assert.ok(text.length > 10, `${lever.id} ${level}: il livello è descritto`);
    clean(text, `testo di ${lever.id}`);
  }
  assert.ok(S.leverLines('esperienza', 3).join(' ').includes('Responsabile regionale'), 'Il testo dice l’incarico da cui si parte');
  lines.push(`regole: ${R.START_LEVERS.length} leve (${R.START_LEVERS.filter(l => l.kind === 'vantaggio').length} vantaggi, ${R.START_LEVERS.filter(l => l.kind === 'zavorra').length} zavorre), ${R.START_PROFILE_ORDER.length} modi di iniziare, punti, esclusioni ed età`);
}

// ---------- 2. il wizard: eurodeputato, condizioni di partenza, riepilogo, validazioni ----------
{
  assert.ok(CAREER_LEVELS.europeo && !CAREER_LEVELS.europeo.chamber, 'L’eurodeputato è un percorso senza Camera');
  assert.equal(careerLevelLabel('europeo'), 'Carriera europea');
  const run = await startCareer({ seed: 'wizard', level: 'comunale' });
  const { store, db } = run;
  const state = store.getState();
  const territory = { units: db.territorialUnits, municipalities: db.municipalities, sourceUrl: db.manifest.territorialSource.url, sourceName: db.manifest.territorialSource.name };
  const render = d => renderCareerWizard(state, { ...makeCareerDraft('2026-09-24'), region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', ...d }, [], () => null, db.parliamentaryGroups, [], [], db.politicians, territory);
  let html = render({ step: 2 });
  assert.ok(html.includes('data-level="europeo"') && html.includes('EURODEPUTATO') && html.includes('Parlamento europeo'), 'Il percorso da eurodeputato è tra i percorsi');
  assert.equal(CAREER_LEVELS.presidenteConsiglio, undefined, 'Il Presidente del Consiglio non è un nuovo livello di carriera.');
  assert.equal(STARTING_ROLES.presidenteConsiglio, undefined, 'Il Presidente del Consiglio non è una posizione di partito.');
  assert.equal(STARTING_OFFICES.presidenteConsiglio.label, 'Presidente del Consiglio');
  assert.ok(html.includes('data-starting-office="presidenteConsiglio"') && html.includes('PRESIDENTE DEL CONSIGLIO'), 'Il PdC è selezionabile come punto di partenza.');
  assert.deepEqual(validateCareerStep({ ...makeCareerDraft('2026-09-24'), initialLevel: 'europeo' }, 2, [], db.parliamentaryGroups), [], 'Da eurodeputato non servono gruppo né Camera');
  const cameraGroup = db.parliamentaryGroups.find(group => group.chamber === 'camera' && group.source === 'real' && group.verified === true && Number(group.memberCount) > 0);
  const senateGroup = db.parliamentaryGroups.find(group => group.chamber === 'senato' && group.source === 'real' && group.verified === true && Number(group.memberCount) > 0);
  assert.ok(cameraGroup && senateGroup, 'Sono disponibili gruppi reali per entrambi i contesti parlamentari.');
  const pdcDraft = { ...makeCareerDraft('2026-09-24'), startingOffice: 'presidenteConsiglio', initialLevel: 'deputato', parliamentaryGroupId: cameraGroup.id };
  assert.deepEqual(validateCareerStep(pdcDraft, 2, [], db.parliamentaryGroups), [], 'PdC con contesto Camera e gruppo reale valido.');
  assert.deepEqual(validateCareerStep({ ...pdcDraft, initialLevel: 'senatore', parliamentaryGroupId: senateGroup.id }, 2, [], db.parliamentaryGroups), [], 'PdC con contesto Senato e gruppo reale valido.');
  assert.ok(validateCareerStep({ ...pdcDraft, initialLevel: 'comunale' }, 2, [], db.parliamentaryGroups).some(text => /Camera o Senato/.test(text)), 'Il PdC senza contesto parlamentare è respinto.');
  html = render({ ...pdcDraft, step: 2 });
  assert.ok(html.includes('data-pdc-chamber="camera"') && html.includes('data-pdc-chamber="senato"') && html.includes('Contesto parlamentare sottostante'), 'Il PdC mantiene la scelta esplicita Camera/Senato.');
  const partyId = db.parties.find(party => party.source === 'real' && party.verified === true)?.id;
  const partyDraft = { ...makeCareerDraft('2026-09-24'), partyMode: 'existing', partyId };
  for (const role of Object.keys(STARTING_ROLES)) assert.deepEqual(validateCareerStep({ ...partyDraft, startingRole: role }, 3, db.parties, db.parliamentaryGroups), [], `Posizione di partito valida: ${role}.`);
  assert.ok(validateCareerStep({ ...partyDraft, partyMode: 'independent', startingRole: 'militante' }, 3, db.parties, db.parliamentaryGroups).some(text => /indipendente/.test(text)), 'Una carriera indipendente non può conservare un ruolo di partito.');
  assert.deepEqual(validateCareerStep({ ...partyDraft, partyMode: 'independent', startingRole: null }, 3, db.parties, db.parliamentaryGroups), [], 'Una carriera indipendente senza posizione di partito è valida.');
  const partyStep = render({ step: 3, partyMode: 'existing', startingRole: 'militante' });
  assert.ok(partyStep.includes('name="startingRole"') && partyStep.includes('Posizione nel partito') && Object.values(STARTING_ROLES).every(role => partyStep.includes(role.label)), 'Le cinque posizioni sono nel passaggio Partito.');
  assert.ok(render({ step: 3, partyMode: 'new', startingOffice: 'presidenteConsiglio', startingRole: 'militante' }).includes('name="startingRole"'), 'Anche fondando un partito da PdC si può scegliere esplicitamente la posizione, senza segreteria automatica.');
  const independentStep = render({ step: 3, partyMode: 'independent', startingRole: null });
  assert.ok(!independentStep.includes('name="startingRole"'), 'La carriera indipendente non mostra il menu delle posizioni di partito.');
  assert.ok(!render({ step: 5, partyMode: 'existing' }).includes('name="startingRole"'), 'Chi sei non ripropone la posizione nel partito.');
  html = render({ step: 4, partyMode: 'existing' });
  assert.ok(html.includes('CONDIZIONI DI PARTENZA') && html.includes('DIFFICOLTÀ'), 'Il passaggio 4 ha la difficoltà e le condizioni di partenza');
  for (const id of R.START_PROFILE_ORDER) assert.ok(html.includes(`data-start-profile="${id}"`), `Scheda di partenza: ${id}`);
  assert.ok(html.includes('aria-pressed="true"') && !html.includes('start-editor'), 'L’editor dei punti si apre solo per lo scenario personalizzato');
  clean(html, 'passaggio 4');
  const divided = render({ step: 4, partyMode: 'independent' });
  assert.ok(/data-start-profile="partito-diviso"[^>]*disabled/.test(divided) && divided.includes('Serve un partito esistente'), 'Il partito diviso è bloccato senza un partito');
  html = render({ step: 4, partyMode: 'existing', start: { profile: 'personalizzato', levels: { rete: 2, nemici: 1 } } });
  assert.ok(html.includes('start-editor') && html.includes('data-start-lever="rete"') && html.includes('data-start-delta="1"') && /da spendere/.test(html), 'Lo scenario personalizzato mostra i punti e una leva per ogni condizione');
  assert.ok(html.includes('Cosa cambia nella tua partenza') && html.includes('Rete di relazioni · livello 2/3'), 'Dice cosa cambia, livello per livello');
  clean(html, 'scenario personalizzato');
  assert.ok(render({ step: 5, start: { profile: 'outsider', levels: {} }, partyMode: 'independent' }).includes('04 · PUNTO DI PARTENZA'), 'Il riepilogo mostra il punto di partenza');
  const pdcSummary = render({ step: 5, startingOffice: 'presidenteConsiglio', initialLevel: 'senatore', partyMode: 'existing', startingRole: 'militante' });
  assert.ok(pdcSummary.includes('<strong>Presidente del Consiglio</strong>') && pdcSummary.includes('Giovane militante') && !pdcSummary.includes('RUOLO INIZIALE'), 'Il riepilogo distingue percorso PdC e appartenenza senza duplicare la posizione.');
  // Le validazioni bloccano partenze impossibili.
  const base = { ...makeCareerDraft('2026-09-24'), partyMode: 'existing', birthDate: '1995-01-01', firstName: 'A', lastName: 'B', gender: 'donna', previousProfession: 'X' };
  assert.ok(validateCareerStep({ ...base, partyMode: 'independent', start: { profile: 'partito-diviso', levels: {} } }, 4, [], []).length > 0, 'Il partito diviso senza partito è respinto al passaggio 4');
  assert.ok(validateCareerStep({ ...base, start: { profile: 'personalizzato', levels: { esperienza: 3, rete: 3 } } }, 4, [], []).some(text => /in rosso/.test(text)), 'Uno scenario in rosso è respinto');
  assert.ok(validateCareerStep({ ...base, start: { profile: 'consolidata', levels: {} } }, 5, [], []).some(text => /richiede almeno 40 anni/.test(text)), 'A 31 anni la carriera consolidata è respinta al passaggio 5');
  assert.deepEqual(validateCareerStep({ ...base, birthDate: BIRTH, start: { profile: 'consolidata', levels: {} } }, 5, [], []), [], 'A 51 anni passa');
  assert.deepEqual(validateCareerStep({ ...base, start: { profile: 'ordinaria', levels: {} } }, 4, [], []), [], 'L’inizio ordinario passa sempre');
  assert.throws(() => store.createCareer({ firstName: 'A', lastName: 'B', birthDate: '1995-01-01', gender: 'donna', region: 'Toscana', municipality: 'Siena', previousProfession: 'X', initialLevel: 'comunale', partyMode: 'independent', difficulty: 'normale', start: { profile: 'personalizzato', levels: { esperienza: 3, rete: 3 } }, policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } }, db.parties, db.parliamentaryGroups), /in rosso|punt/, 'Il motore rifiuta una partenza non valida anche senza il wizard');
  lines.push('wizard: sette punti di partenza inclusi PdC, posizioni di partito separate, editor dei punti, riepilogo e validazioni');
}

// ---------- 3. l’inizio ordinario resta quello di sempre ----------
{
  const run = await startCareer({ seed: 'ordinaria', level: 'deputato', draft: { birthDate: BIRTH } });
  const { store } = run;
  let s = store.getState();
  assert.equal(s.career.start, null, 'Nessuna condizione di partenza');
  assert.equal(s.career.startProfile, 'ordinaria');
  assert.equal(s.game.start, undefined, 'Nessuno stato di partenza nella partita');
  assert.deepEqual(S.startMods(s.game), S.NO_MODS, 'Nessun effetto sugli altri motori');
  for (let i = 0; i < 40; i++) { store.advance(7); s = store.getState(); assert.ok(!inboxIds(s).some(id => id.startsWith('start-')), 'Nessuna decisione di partenza'); }
  noIssues(s, 'inizio ordinario');
  // Un vecchio salvataggio (senza start) si legge e si gioca.
  const old = normalizeGameState(JSON.parse(JSON.stringify(s.game)));
  assert.equal(old.start, undefined);
  assert.deepEqual(S.startMods(old), S.NO_MODS);
  assert.deepEqual(S.startMoment('partito', old), []);
  assert.equal(S.startBase(old, 'leadership'), 0);
  lines.push('partenza ordinaria invariata: nessuna condizione, nessun effetto, vecchi salvataggi leggibili');
}

// ---------- 4. l’eurodeputato ----------
{
  const run = await startCareer({ seed: 'europeo', level: 'europeo', draft: { birthDate: BIRTH } });
  const { store } = run;
  let s = store.getState();
  assert.equal(s.career.initialLevel, 'europeo');
  assert.equal(s.parliament, null, 'Nessun seggio nella Camera o nel Senato');
  const office = s.dataset.offices.find(item => item.id === s.dataset.politicians.find(p => p.id === s.career.playerId).roleId);
  assert.deepEqual([office.title, office.institution, office.level, office.endDate], ['Deputato al Parlamento europeo (scenario di simulazione)', 'Parlamento europeo', 'europee', null], 'L’incarico è un mandato europeo in corso');
  const ep = (s.local?.institutions ?? []).find(item => item.kind === 'europa' && item.status === 'active');
  assert.ok(ep && ep.playerRole === 'eurodeputato' && ep.ep?.member && ep.ep?.substitute, 'Un seggio nel Parlamento europeo, con la commissione e il supplente');
  assert.ok(ep.playerGroupId && ep.groups.some(group => group.id === ep.playerGroupId), 'Nel gruppo europeo del partito');
  assert.ok(ep.until && ep.until > s.clock.currentDate, `Il mandato dura fino alle europee (${ep.until})`);
  assert.ok(playerRoles(s).roles.some(([, label]) => /Parlamento europeo/.test(label)), 'Il ruolo è tra quelli del giocatore');
  assert.ok(playerRoles(s).powers.find(item => item.label.startsWith('Relazioni, emendamenti e voti nelle commissioni del Parlamento europeo'))?.enabled !== false, 'I poteri europei sono disponibili');
  const track = careerOverview(s).tracks.find(item => item.id === 'istituzioni');
  assert.ok(track.steps.find(step => step.id === 'eurodeputato').current, 'Il percorso delle istituzioni mostra il mandato europeo in corso');
  assert.ok(s.game.elections.some(item => item.type === 'europee' && item.status === 'upcoming'), 'Le europee sono in calendario');
  assert.ok(statOf(s, 'experience') >= 50 && statOf(s, 'notoriety') >= 45, 'Esperienza e notorietà di chi siede già in Europa');
  // Si gioca: la settimana europea, i voti, le commissioni.
  for (let i = 0; i < 26; i++) store.advance(7);
  s = store.getState();
  const after = s.local.institutions.find(item => item.kind === 'europa' && item.status === 'active');
  assert.ok(after.acts.length + after.archive.length > 0, 'Il Parlamento europeo lavora: atti in corso o archiviati');
  noIssues(s, 'eurodeputato');
  clean(renderCareerPage(s, { tab: 'percorso' }), 'Carriera da eurodeputato');
  // Indipendente: non iscritti.
  const free = await startCareer({ seed: 'europeo-ni', level: 'europeo', draft: { birthDate: BIRTH, partyMode: 'independent', partyId: null } });
  const ni = free.store.getState().local.institutions.find(item => item.kind === 'europa');
  assert.equal(ni.playerGroupId, 'ni', 'Senza partito siedi tra i non iscritti');
  lines.push(`eurodeputato: seggio nel Parlamento europeo (gruppo ${ep.playerGroupId}, commissione ${ep.ep.member.toUpperCase()}), mandato fino al ${ep.until}, non iscritti se indipendente, 26 settimane giocate`);
}

// ---------- 4b. l’eurodeputato di partenza si ricandida alle europee ----------
{
  const give = store => { const s = store.getState(); s.game.week.ap = Math.max(s.game.week.ap, 6); s.game.resources.funds = Math.max(s.game.resources.funds, 50000); s.game.resources.politicalCapital = 80; if (s.game.party) s.game.party.support = 90; };
  const forceWin = store => {
    const c = store.getState().campaign;
    c.nomination.status = 'approved'; c.nomination.internalSupport = 10; c.candidacy.listPosition = 1;
    c.candidateStats = { ...c.candidateStats, notoriety: 98, reputation: 98, popularity: 98 };
    c.activityUses = { ...c.activityUses, door_to_door: 12 };
    for (const area of c.territories) { const ids = Object.keys(area.supportByCandidate); area.supportByCandidate = Object.fromEntries(ids.map(id => [id, id === c.playerCandidateId ? 60 : 40 / Math.max(1, ids.length - 1)])); }
    c.day = c.totalDays - 1;
    store.advance(1);
  };
  // A re-election depends on how the list of the party does in the whole country (a result of the simulated world, not of the test):
  // the same start is tried with a few seeds until the list passes the threshold and the player is elected.
  let run = null, first = null, s = null;
  for (const seed of ['europeo-voto', 'europeo-voto-b', 'europeo-voto-c', 'europeo-voto-d', 'europeo-voto-e', 'europeo-voto-f']) {
    run = await startCareer({ seed, level: 'europeo', draft: { birthDate: BIRTH } });
    const { store, db } = run;
    first = store.getState().local.institutions.find(item => item.kind === 'europa');
    give(store);
    assert.ok(store.fastForwardToElection('europee'), 'La finestra delle candidature europee si apre');
    give(store);
    store.startCampaign({ electionType: 'europee', objective: 'seat' }, db.parties, { politicians: db.politicians, groups: db.parliamentaryGroups });
    assert.equal(store.getState().campaign.candidacy.role, 'eurodeputato', 'Si corre per il seggio europeo');
    forceWin(store);
    if (store.getState().campaign?.status === 'active') forceWin(store);
    s = store.getState();
    if (s.career.lastElectionResult?.personalMandate) break;
  }
  assert.ok(s.career.lastElectionResult?.personalMandate, `Mandato europeo conquistato (${s.career.lastElectionResult?.outcomeLabel})`);
  const councils = s.local.institutions.filter(item => item.kind === 'europa');
  assert.ok(councils.some(item => item.status === 'active' && item.since > first.since) && councils.some(item => item.status === 'concluso'), 'Il nuovo mandato europeo sostituisce quello di partenza, che si conclude');
  assert.equal(s.career.currentLevel, 'europeo', 'Il livello della carriera resta quello europeo');
  noIssues(s, 'eurodeputato rieletto');
  lines.push('eurodeputato di partenza rieletto alle europee: nuovo mandato, il primo concluso');
}

// ---------- 5. l’outsider ----------
{
  const ordinary = await startCareer({ seed: 'confronto', level: 'deputato', draft: { birthDate: BIRTH } });
  const base = ordinary.store.getState();
  const baseline = { popularity: statOf(base, 'popularity'), influence: statOf(base, 'influence'), notoriety: statOf(base, 'notoriety'), leadership: relation(base, 'leadership'), support: base.game.party.support, civic: relation(base, 'civic') };
  const baselineOdds = careerOverview(base).tracks.find(item => item.id === 'partito').odds;
  const run = await startCareer({ seed: 'confronto', level: 'deputato', draft: { birthDate: BIRTH, start: { profile: 'outsider', levels: {} } } });
  const { store } = run;
  let s = store.getState();
  assert.equal(s.career.startProfile, 'outsider');
  assert.deepEqual(s.game.start.levels, R.START_PROFILES.outsider.levels);
  assert.ok(statOf(s, 'popularity') > baseline.popularity + 8 && statOf(s, 'notoriety') > baseline.notoriety + 20, 'Più popolarità e notorietà: è una faccia nuova');
  assert.ok(statOf(s, 'influence') < baseline.influence - 5, 'Ma meno influenza: nessun apparato alle spalle');
  assert.ok(relation(s, 'leadership') < baseline.leadership - 10 && s.game.party.support < baseline.support - 10, 'Rapporto freddo con la leadership e poco sostegno nel partito');
  assert.ok(relation(s, 'civic') > baseline.civic + 5, 'Ma più rapporti con associazioni e comitati');
  const startLeadership = relation(s, 'leadership');
  const mods = S.startMods(s.game);
  assert.ok(mods.appeal > 2 && mods.nomination < -1 && mods.partyScore < -2, `Effetti sugli altri motori: fascino ${mods.appeal}, candidature ${mods.nomination}, promozioni ${mods.partyScore}`);
  const odds = careerOverview(s).tracks.find(item => item.id === 'partito').odds;
  assert.ok(odds.moment.some(item => /Outsider/.test(item.label) && item.value < 0), 'Le promozioni di partito pesano la mancanza di apparato');
  assert.ok(odds.chance < baselineOdds.chance, `Le probabilità di promozione sono più basse (${odds.chance} contro ${baselineOdds.chance})`);
  assert.ok(S.startBase(s.game, 'leadership') < -8, 'Anche il livello a cui tornano i rapporti si abbassa');
  // L’apparato lo mette alla prova alla quarta settimana.
  let week = s.game.week.index;
  while (week < 6 && !inboxIds(s).includes('start-outsider-apparato')) { store.advance(7); s = store.getState(); week = s.game.week.index; }
  const offer = s.game.inbox.find(item => item.templateId === 'start-outsider-apparato');
  assert.ok(offer && offer.choices.length === 3, 'L’apparato propone di normalizzarti');
  const leadershipBefore = relation(s, 'leadership');
  store.resolveAgendaItem(offer.id, 'accetta');
  s = store.getState();
  assert.ok(s.game.start.outsider.integration >= 0.5 && relation(s, 'leadership') > leadershipBefore, 'Accettare ti integra e scalda la leadership');
  // Più si integra, meno è outsider: nel tempo il livello scende e con lui il fascino e la distanza.
  s.game.relations.find(item => item.id === 'leadership').value = 80; s.game.party.support = 80; s.game.party.rank = 2; s.game.start.outsider.integration = 0.95;
  for (let i = 0; i < 6; i++) { store.advance(7); }
  s = store.getState();
  assert.ok(s.game.start.outsider.level < 3, `Dopo l’integrazione il livello scende (${s.game.start.outsider.level}/3)`);
  assert.ok(s.game.memory.some(item => /outsider/i.test(item.text)) && s.game.log.some(item => /outsider/i.test(item.title)), 'Resta nella memoria e nel diario');
  assert.ok(S.startMods(s.game).appeal < mods.appeal && S.startMoment('partito', s.game)[0][1] > -3, 'Il fascino cala insieme alla distanza dall’apparato');
  noIssues(s, 'outsider');
  clean(renderCareerPage(s, { tab: 'percorso' }), 'Carriera outsider');
  assert.ok(renderCareerPage(s, { tab: 'percorso' }).includes('Outsider') && renderCareerPage(s, { tab: 'percorso' }).includes('integrazione'), 'La Carriera mostra la condizione e il suo stato');
  lines.push(`outsider: popolarità +${Math.round(statOf(store.getState(), 'popularity') - baseline.popularity)}, leadership ${Math.round(baseline.leadership)}→${Math.round(startLeadership)}, promozioni ${Math.round(baselineOdds.chance * 100)}%→${Math.round(odds.chance * 100)}%, apparato alla 5ª settimana, integrazione nel tempo`);
}

// ---------- 6. i debiti politici ----------
{
  const ordinary = await startCareer({ seed: 'debiti', level: 'deputato', draft: { birthDate: BIRTH } });
  const base = ordinary.store.getState();
  const baseFunds = base.game.resources.funds; const baseCapital = base.game.resources.politicalCapital;
  const run = await startCareer({ seed: 'debiti', level: 'deputato', draft: { birthDate: BIRTH, start: { profile: 'debiti', levels: {} } } });
  const { store } = run;
  let s = store.getState();
  assert.ok(s.game.resources.funds > baseFunds * 2 && s.game.resources.politicalCapital >= baseCapital + 10, `Fondi e capitale di partenza più alti (${baseFunds}→${s.game.resources.funds}, ${baseCapital}→${s.game.resources.politicalCapital})`);
  const debts = s.game.start.debts;
  assert.equal(debts.length, 2, 'Due creditori');
  assert.ok(debts.every(debt => debt.status === 'aperto' && debt.due >= R.START_PACE.firstDebt && R.DEBT_KINDS[debt.kind]) && new Set(debts.map(debt => debt.kind)).size === 2, 'Creditori diversi, con una scadenza');
  assert.ok(debts.every(debt => /figura simulata|simulat/.test(debt.creditor) || /comitati e le associazioni/.test(debt.creditor)), 'I creditori sono ruoli simulati, mai persone reali');
  // Alla scadenza il creditore chiede il favore.
  s.game.start.debts[0].due = s.game.week.index;
  store.advance(7); s = store.getState();
  let item = s.game.inbox.find(entry => entry.templateId === 'start-debito');
  assert.ok(item && item.params.debtId === 'debito-1' && item.body.includes(item.params.creditor.slice(0, 20)), 'Alla scadenza il creditore chiede il suo favore');
  assert.deepEqual(item.choices.map(choice => choice.id), ['salda', 'tratta', 'rifiuta', 'attendi']);
  // Pagare: costa capitale, il creditore è contento, il debito è saldato.
  let capital = s.game.resources.politicalCapital; const rel = relation(s, item.params.targetId);
  store.resolveAgendaItem(item.id, 'salda'); s = store.getState();
  assert.equal(s.game.start.debts[0].status, 'saldato');
  // Onorare un debito costa 4 capitale; pagare un debito soddisfa «Chi mantiene i patti», che a sua volta rende 2 (obiettivi di carriera).
  assert.equal(capital - s.game.resources.politicalCapital, s.game.objectives.patti ? 2 : 4, 'Onorare il debito costa 4 punti di capitale (meno il premio di «Chi mantiene i patti»)');
  assert.ok(s.game.objectives.patti, 'Pagare un debito soddisfa «Chi mantiene i patti»');
  assert.ok(relation(s, item.params.targetId) > rel, 'Il creditore apprezza');
  assert.ok(s.game.pending.some(entry => /favore concesso/i.test(entry.label)), 'E il favore può far rumore più avanti (una conseguenza programmata)');
  // Rifiutare: un nemico, un tradimento nella memoria, una conseguenza sulla stampa.
  s.game.start.debts[1].due = s.game.week.index;
  store.advance(7); s = store.getState();
  item = s.game.inbox.find(entry => entry.templateId === 'start-debito');
  assert.equal(item.params.debtId, 'debito-2');
  const enemies = s.game.start.enemies.length;
  store.resolveAgendaItem(item.id, 'rifiuta'); s = store.getState();
  assert.equal(s.game.start.debts[1].status, 'tradito');
  assert.equal(s.game.start.enemies.length, enemies + 1, 'Chi viene tradito diventa un nemico');
  assert.ok(s.game.memory.some(entry => entry.kind === 'alleato-tradito'), 'Il tradimento resta nella memoria politica');
  assert.ok(s.game.pending.some(entry => /creditore tradito/i.test(entry.label)), 'E il creditore può parlare con la stampa');
  // Il nemico nato dal debito colpisce a sua volta: un altro ciclo.
  s.game.start.enemies.at(-1).nextAttack = s.game.week.index;
  store.advance(7); s = store.getState();
  assert.ok(inboxIds(s).includes('start-nemico'), 'Il nemico nato dal debito torna all’attacco');
  noIssues(s, 'debiti');
  lines.push('debiti: fondi e capitale più alti, due creditori con scadenze, pagare/rinviare/rifiutare con costi e conseguenze, il tradito diventa un nemico');
}

// ---------- 6b. la pazienza dei creditori ----------
{
  const run = await startCareer({ seed: 'pazienza', level: 'deputato', draft: { birthDate: BIRTH, start: { profile: 'debiti', levels: {} } } });
  const { store } = run;
  let s = store.getState();
  const debt = () => store.getState().game.start.debts[0];
  // Senza una decisione la richiesta scade da sola: il creditore aspetta ma si irrita.
  s.game.start.debts[0].due = s.game.week.index;
  store.advance(7); s = store.getState();
  assert.ok(inboxIds(s).includes('start-debito'));
  store.advance(7); s = store.getState();
  assert.ok(debt().deferred === 1 && debt().severity === 2 && debt().status === 'aperto', 'Senza risposta il debito è rinviato e la pretesa cresce');
  // Troppi rinvii: perde la pazienza.
  for (let n = 0; n < 4 && debt().status === 'aperto'; n++) {
    s = store.getState(); s.game.start.debts[0].due = s.game.week.index;
    store.advance(7); s = store.getState();
    const request = s.game.inbox.find(entry => entry.templateId === 'start-debito');
    if (request) { try { store.resolveAgendaItem(request.id, 'attendi'); } catch { /* */ } }
  }
  s = store.getState();
  assert.equal(debt().status, 'tradito', 'Dopo troppi rinvii il creditore perde la pazienza');
  assert.ok(s.game.memory.some(entry => /perso la pazienza/.test(entry.text)) && s.game.start.enemies.some(enemy => enemy.origin === 'debito'), 'Diventa un nemico e resta nella memoria');
  noIssues(s, 'pazienza dei creditori');
  lines.push('pazienza dei creditori: senza risposta il debito è rinviato, la pretesa cresce e al terzo rinvio il creditore rompe');
}

// ---------- 7. il partito già diviso ----------
{
  const ordinary = await startCareer({ seed: 'diviso', level: 'deputato', draft: { birthDate: BIRTH } });
  const base = ordinary.store.getState();
  const baseOdds = careerOverview(base).tracks.find(item => item.id === 'partito').odds;
  const baseCohesion = base.game.party.org.cohesion;
  const run = await startCareer({ seed: 'diviso', level: 'deputato', draft: { birthDate: BIRTH, start: { profile: 'partito-diviso', levels: {} } } });
  const { store } = run;
  let s = store.getState();
  const party = s.game.party;
  assert.ok(party.org.cohesion <= baseCohesion - 25 && party.org.cohesion >= 22, `Coesione bassa (${baseCohesion}→${party.org.cohesion})`);
  assert.ok(party.org.conflicts.length === 2 && party.org.conflicts.every(item => item.intensity >= 60 && item.currents.length === 2), 'Due scontri aperti tra le aree più forti');
  assert.ok(party.org.congress.nextWeek <= 15, `Il congresso è vicino (settimana ${party.org.congress.nextWeek})`);
  const aggrieved = Object.values(party.life.actors).filter(actor => actor.grievance >= 30).length;
  assert.ok(aggrieved >= 2, 'Le aree non al comando hanno rancori');
  const odds = careerOverview(s).tracks.find(item => item.id === 'partito').odds;
  assert.ok(odds.moment.some(item => /leadership è contendibile/.test(item.label) && item.value > 0), 'La leadership è contendibile: più peso nelle sfide interne');
  assert.ok(S.startMods(s.game).nomination < 0, 'Ma le candidature sono più contese');
  // Il primo appello: schierarsi.
  while (!inboxIds(s).includes('start-partito-spaccato') && s.game.week.index < 6) { store.advance(7); s = store.getState(); }
  const call = s.game.inbox.find(item => item.templateId === 'start-partito-spaccato');
  assert.ok(call && call.choices.length === 4 && call.params.currentAId && call.params.currentBId, 'Le due aree ti cercano: pontiere, schierarsi (due) o restare fuori');
  assert.equal(s.game.inbox[0].templateId, 'start-partito-spaccato', 'È una decisione urgente');
  store.resolveAgendaItem(call.id, 'a'); s = store.getState();
  assert.equal(s.game.party.alignedCurrentId, call.params.currentAId, 'Schierarsi allinea la tua area interna');
  assert.equal(s.game.start.divided.side, call.params.currentAId);
  // Finché dura la crisi pesa; quando il partito si ricompone, il bonus finisce e resta nella memoria.
  // (the events of the weeks may chip at the cohesion: the recomposition is kept up until it is recognised)
  for (let i = 0; i < 14 && !store.getState().game.start.divided.resolvedAt; i++) { const live = store.getState().game; live.party.org.conflicts = []; live.party.org.cohesion = Math.max(live.party.org.cohesion, 64); store.advance(7); }
  s = store.getState();
  assert.ok(s.game.start.divided.resolvedAt, 'Il partito si ricompone');
  assert.ok(s.game.memory.some(item => /ricomposto/.test(item.text)) && s.game.log.some(item => /si ricompone/i.test(item.title)), 'Resta nella memoria e nel diario');
  assert.ok(!S.startMoment('partito', s.game).some(([label]) => /contendibile/.test(label)) && S.startMods(s.game).nomination === 0.5, 'Chiusa la crisi, i bonus e i malus della divisione finiscono (resta il protettore nel partito)');
  noIssues(s, 'partito diviso');
  // Il ponte: costa capitale e può riuscire o fallire.
  const second = await startCareer({ seed: 'diviso-ponte', level: 'deputato', draft: { birthDate: BIRTH, start: { profile: 'partito-diviso', levels: {} } } });
  let t = second.store.getState();
  while (!inboxIds(t).includes('start-partito-spaccato') && t.game.week.index < 6) { second.store.advance(7); t = second.store.getState(); }
  const capital = t.game.resources.politicalCapital; const intensity = t.game.party.org.conflicts[0].intensity;
  second.store.resolveAgendaItem(t.game.inbox.find(item => item.templateId === 'start-partito-spaccato').id, 'ponte'); t = second.store.getState();
  assert.equal(capital - t.game.resources.politicalCapital, 3, 'Fare da pontiere costa 3 capitale');
  assert.ok(t.game.party.org.conflicts[0]?.intensity < intensity || t.game.party.org.conflicts.length < 2, 'Lo scontro si smorza');
  assert.equal(t.game.start.divided.mediated, 1);
  lines.push(`partito diviso: coesione ${baseCohesion}→${party.org.cohesion}, due scontri, congresso a settimana ${party.org.congress.nextWeek}, promozioni ${Math.round(baseOdds.chance * 100)}%→${Math.round(odds.chance * 100)}% finché dura, schierarsi/pontiere, ricomposizione`);
}

// ---------- 8. la carriera consolidata ----------
{
  const ordinary = await startCareer({ seed: 'consolidata', level: 'deputato', draft: { birthDate: BIRTH } });
  const base = ordinary.store.getState();
  const baseline = { experience: statOf(base, 'experience'), influence: statOf(base, 'influence'), reputation: statOf(base, 'reputation'), rank: base.game.party.rank, rival: relation(base, 'rival') };
  const baseFactors = progressionFactors({ game: base.game, stats: Object.fromEntries(base.dataset.statistics.map(item => [item.metric, item.value])) });
  const run = await startCareer({ seed: 'consolidata', level: 'deputato', draft: { birthDate: BIRTH, start: { profile: 'consolidata', levels: {} } } });
  const { store } = run;
  let s = store.getState();
  assert.ok(statOf(s, 'experience') >= baseline.experience + 25 && statOf(s, 'influence') >= baseline.influence + 12 && statOf(s, 'reputation') >= baseline.reputation + 5 - 4, 'Esperienza, influenza e reputazione di una carriera alle spalle');
  assert.equal(s.game.party.rank, 2, 'Da iscritto parti già come responsabile regionale');
  assert.equal(s.game.party.rankTitle, 'Responsabile regionale');
  assert.ok(s.game.party.history.some(item => /anni di lavoro/.test(item.text)), 'Lo dice la storia nel partito');
  assert.ok(relation(s, 'rival') < baseline.rival - 10, 'Ma ha già dei nemici: il rivale è più ostile');
  assert.equal(s.game.start.enemies.length, 2);
  assert.equal(s.game.start.shadows.length, 1, 'E un’ombra nel passato');
  assert.ok(s.game.memory.some(item => item.kind === 'scandalo') && s.game.memory.some(item => item.kind === 'vittoria-elettorale'), 'La memoria politica ha il bene e il male del passato');
  const factors = progressionFactors({ game: s.game, stats: Object.fromEntries(s.dataset.statistics.map(item => [item.metric, item.value])) });
  assert.ok(factors.seniority >= baseFactors.seniority + 20, 'L’anzianità pesa nelle promozioni');
  const mods = S.startMods(s.game);
  assert.ok(mods.expectation >= 5.9 && mods.expectation <= 6.1, `Le aspettative sono alte (+${mods.expectation} punti alle elezioni)`);
  assert.ok(s.game.timeline.some(item => /Punto di partenza: Carriera già consolidata/.test(item.title)), 'La cronologia lo registra');
  // Le attese alzano l’asticella: lo stesso risultato vale “sotto le attese”.
  const campaign = share => ({ playerCandidateId: 'p', expectation: { share, pollShare: share }, consensusHistory: [{ value: share }], preparation: {} });
  const result = { playerShare: 20, personalMandate: true, winnerGroupId: 'p', groups: [{ id: 'p', percent: 20 }, { id: 'q', percent: 15 }], personal: { code: 'eletto' } };
  assert.equal(classifyOutcome(campaign(20), result).expectation, 'in-linea', 'Senza pressione il risultato è in linea');
  assert.equal(classifyOutcome({ ...campaign(20), expectation: { share: 20, pressure: 6 } }, result).expectation, 'sotto', 'Con le attese di una carriera consolidata è sotto le attese');
  assert.equal(classifyOutcome({ ...campaign(20), expectation: { share: 20, pressure: 6 } }, result).expected, 26);
  // Il nemico torna all’attacco, il passato riemerge.
  s.game.start.enemies[0].nextAttack = s.game.week.index; s.game.start.shadows[0].surfaceWeek = s.game.week.index;
  store.advance(7); s = store.getState();
  assert.ok(inboxIds(s).includes('start-nemico') && inboxIds(s).includes('start-passato'), 'Un nemico attacca e il passato torna a galla');
  const attack = s.game.inbox.find(item => item.templateId === 'start-nemico');
  const calm = attack.choices.find(choice => choice.id === 'accordo');
  const capital = s.game.resources.politicalCapital;
  store.resolveAgendaItem(attack.id, 'accordo'); s = store.getState();
  assert.equal(capital - s.game.resources.politicalCapital, 4);
  assert.ok(s.game.start.enemies[0].calmUntil > s.game.week.index + 40, 'L’accordo placa il nemico per un anno');
  const past = s.game.inbox.find(item => item.templateId === 'start-passato');
  store.resolveAgendaItem(past.id, 'chiarisci'); s = store.getState();
  assert.equal(s.game.start.shadows[0].state, 'chiusa', 'Affrontato, il passato si chiude');
  // Le attese deluse: sotto la soglia perdi sostegno e qualcuno lo dice.
  s.game.start.expectation.lastCheck = s.game.week.index - 30;
  // Sotto le attese (popolarità 20 contro 57) il sostegno nel partito cala di 0,3 a settimana, e qualcuno lo dice.
  const probe = JSON.parse(JSON.stringify(s.game)); probe.party.support = 70;
  const pressure = S.advanceStart(probe, { remember() {}, changeRelation() {} }, { week: probe.week.index, stats: { popularity: 20 } });
  assert.equal(probe.party.support, 69.7, 'Sotto le attese si perde sostegno nel partito');
  assert.ok(pressure.raises.some(item => item.id === 'start-attese' && item.params.expected === 57), 'E qualcuno lo dice ad alta voce');
  const calmProbe = JSON.parse(JSON.stringify(s.game)); calmProbe.party.support = 70;
  S.advanceStart(calmProbe, { remember() {}, changeRelation() {} }, { week: calmProbe.week.index, stats: { popularity: 60 } });
  assert.equal(calmProbe.party.support, 70, 'Sopra le attese non si perde nulla');
  s.dataset.statistics.find(item => item.subjectId === s.career.playerId && item.metric === 'popularity').value = 20;
  store.advance(7); s = store.getState();
  assert.ok(inboxIds(s).includes('start-attese'), 'Nella partita la richiesta arriva nell’agenda');
  const levelBefore = S.startMods(s.game).expectation;
  store.resolveAgendaItem(s.game.inbox.find(item => item.templateId === 'start-attese').id, 'pazienza'); s = store.getState();
  assert.equal(s.game.start.expectation.lowered, 1);
  assert.ok(S.startMods(s.game).expectation < levelBefore, 'Chiedere pazienza abbassa le aspettative di un livello');
  noIssues(s, 'carriera consolidata');
  clean(renderCareerPage(s, { tab: 'percorso' }), 'Carriera consolidata');
  lines.push(`consolidata: esperienza ${Math.round(baseline.experience)}→${Math.round(statOf(store.getState(), 'experience'))}, parte da responsabile regionale, due nemici, un’ombra, attese +${mods.expectation} (un risultato in linea diventa “sotto le attese”)`);
}

// ---------- 9. lo scenario personalizzato ----------
{
  const levels = { rete: 2, risorse: 1, nemici: 2, outsider: 1 };
  const plan = S.startPlan({ profile: 'personalizzato', levels }, { partyMode: 'existing' });
  assert.deepEqual(plan.points, { free: 6, spent: 5, gained: 4, balance: 5 }, 'Punti dello scenario: 6 liberi + 4 dalle zavorre − 5 dei vantaggi');
  const ordinary = await startCareer({ seed: 'custom', level: 'deputato', draft: { birthDate: BIRTH } });
  const baseFunds = ordinary.store.getState().game.resources.funds;
  const run = await startCareer({ seed: 'custom', level: 'deputato', draft: { birthDate: BIRTH, start: { profile: 'personalizzato', levels } } });
  const { store } = run;
  let s = store.getState();
  assert.equal(s.career.startProfile, 'personalizzato');
  assert.ok(s.career.start.custom === true, 'Segnato come scenario personalizzato');
  assert.deepEqual(s.game.start.levels, levels);
  assert.ok(Math.abs(s.game.resources.funds - Math.round(baseFunds * 1.6)) <= 1, `Fondi ×1,6 (${baseFunds}→${s.game.resources.funds})`);
  assert.equal(s.game.start.enemies.length, 2);
  assert.ok(s.game.start.outsider.level === 1 && s.game.start.debts.length === 0, 'Solo ciò che hai scelto');
  assert.ok(relation(s, 'civic') > 50, 'La rete di relazioni alza i rapporti con il territorio');
  // Senza un partito esistente, le leve di partito sono scartate (e il saldo ne tiene conto).
  const solo = await startCareer({ seed: 'custom-solo', level: 'deputato', draft: { birthDate: BIRTH, partyMode: 'independent', partyId: null, start: { profile: 'personalizzato', levels: { sostegno: 2, 'partito-diviso': 1, rete: 1 } } } });
  const soloState = solo.store.getState();
  assert.deepEqual(soloState.game.start.levels, { rete: 1 }, 'Senza partito restano solo le leve che non lo richiedono');
  assert.deepEqual(soloState.career.start.dropped.sort(), ['partito-diviso', 'sostegno']);
  for (let i = 0; i < 30; i++) solo.store.advance(7);
  noIssues(solo.store.getState(), 'scenario personalizzato');
  clean(renderCareerPage(solo.store.getState(), { tab: 'percorso' }), 'Carriera con scenario personalizzato');
  lines.push('scenario personalizzato: punti 6 + zavorre − vantaggi, fondi ×1,6, leve applicate, leve di partito scartate senza partito');
}

// ---------- 10. nel tempo: tutte le partenze reggono, con campagne e invarianti ----------
{
  for (const [seed, level, start, partyMode] of [['t-outsider', 'comunale', 'outsider', 'existing'], ['t-debiti', 'regionale', 'debiti', 'existing'], ['t-diviso', 'deputato', 'partito-diviso', 'existing'], ['t-consolidata', 'senatore', 'consolidata', 'existing'], ['t-europeo', 'europeo', 'outsider', 'independent']]) {
    const run = await startCareer({ seed, level, draft: { birthDate: BIRTH, partyMode, ...(partyMode === 'independent' ? { partyId: null } : {}), start: { profile: start, levels: {} } } });
    const { store } = run;
    const seen = new Set();
    for (let i = 0; i < 80; i++) {
      const s = store.getState();
      for (const item of s.game.inbox) { if (item.templateId.startsWith('start-')) seen.add(item.templateId); }
      for (const item of [...s.game.inbox]) { const choice = item.choices[(i + item.templateId.length) % item.choices.length]; try { store.resolveAgendaItem(item.id, choice.id); } catch { /* costo non sostenibile questa settimana */ } }
      store.advance(7);
      if (i % 20 === 19) noIssues(store.getState(), `${seed} settimana ${i + 1}`);
    }
    const s = store.getState();
    noIssues(s, `${seed} dopo 80 settimane`);
    assert.ok(s.game.start, `${seed}: lo stato di partenza resta nella partita`);
    clean(renderCareerPage(s, { tab: 'percorso' }), `${seed}: Carriera`);
    lines.push(`${seed} (${level}, ${start}): 80 settimane, decisioni di partenza viste: ${[...seen].join(', ') || 'nessuna'}`);
  }
}

// ---------- 11. campagna: le condizioni di partenza entrano nella campagna ----------
{
  const run = await startCareer({ seed: 'campagna-partenza', level: 'comunale', draft: { birthDate: BIRTH, start: { profile: 'consolidata', levels: {} } } });
  const { store, db } = run;
  const open = store.fastForwardToElection('comunale');
  assert.ok(open, 'Finestra delle candidature raggiunta');
  const game = store.getState().game;
  const mods = S.startMods(game);
  store.startCampaign({ electionType: 'comunale', role: 'consigliere', objective: 'seat' }, db.parties, { politicians: db.politicians, groups: db.parliamentaryGroups });
  const campaign = store.getState().campaign;
  // The pressure of the start adds to what the term that ends says (the record of the administration), it does not replace it.
  assert.equal(campaign.expectation.pressure, Math.round((mods.expectation + (campaign.incumbency?.expectation ?? 0)) * 100) / 100, 'La pressione delle attese entra nella campagna');
  assert.ok(campaign.history.some(item => /Condizioni di partenza/.test(item.text)), 'La campagna ricorda le condizioni di partenza');
  clean(JSON.stringify(campaign.history), 'storia della campagna');
  lines.push(`campagna: pressione delle attese +${mods.expectation} e condizioni di partenza nella storia della campagna`);
}

console.log(`Condizioni di partenza verificate:\n- ${lines.join('\n- ')}`);
