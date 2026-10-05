// The events of the week (DAILY_EVENTS and the procedural CAREER_EVENTS, one pool for the engine): the catalogue is sound,
// every event can happen to someone, none is always eligible, the draws follow the situation and not the weekday, the
// frequency is balanced, cooldowns, families and the weekly budget hold, the important events are not crowded out by the
// ordinary ones, and the political world asks for a position only when it concerns the player's role.
import assert from 'node:assert/strict';
import { addWorldReaction, advanceWeek, createGameState, describeEffects, resolveInboxItem, situation } from '../src/core/career-engine.js';
import { AGENDA_CAPS, APPOINTMENTS, CAREER_EVENTS, FORCED_EVENTS, RELATION_TEMPLATES, SITUATION_EVENTS, STAT_LABELS } from '../src/data/simulation/career-rules.js';
import { LIFE_SITUATIONS } from '../src/data/simulation/party-life-rules.js';
import { PRESIDENCY_SITUATIONS } from '../src/data/simulation/presidency-rules.js';
import { START_SITUATIONS } from '../src/data/simulation/start-rules.js';
import { OBJECTIVE_SITUATIONS } from '../src/data/simulation/objective-rules.js';
import { DAILY_EVENTS } from '../src/data/simulation/daily-events.js';
import { eventDay, reactionRelevance } from '../src/core/event-engine.js';
import { localOffices } from '../src/core/office-engine.js';
import { createCommittees } from '../src/core/committee-engine.js';

const POOL = [...CAREER_EVENTS, ...DAILY_EVENTS];
const byId = Object.fromEntries(POOL.map(item => [item.id, item]));
const START = '2027-01-04';
const addDays = (date, days) => { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10); };
const seasons = date => { const month = Number(date.slice(5, 7)); return { summer: month >= 6 && month <= 8, autumn: month >= 9 && month <= 11, winter: month === 12 || month <= 2 }; };
const rander = seed => { let a = [...seed].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 7) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const meets = (requirement, sit) => !requirement || (typeof requirement === 'function' ? requirement(sit) : Boolean(sit[requirement]));
const isImportant = event => AGENDA_CAPS.importantCategories.includes(event.category) || event.exclusive === 'emergenza';
const average = list => list.reduce((sum, value) => sum + value, 0) / Math.max(1, list.length);

// ---------- 1. the catalogue ----------
{
  const ids = POOL.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length, 'Eventi: id univoci tra procedurali e giornalieri');
  assert.ok(DAILY_EVENTS.length >= 85 && CAREER_EVENTS.length >= 60, `Catalogo ampio (${DAILY_EVENTS.length} giornalieri, ${CAREER_EVENTS.length} procedurali)`);
  const placeholders = new Set(['municipality', 'region', 'region2', 'rival', 'party', 'currentA', 'currentB', 'event', 'eventBody', 'memory', 'lawTitle', 'scope']);
  const referenced = new Set();
  for (const item of POOL) {
    assert.ok(item.category || item.weight === 0, `${item.id}: ha una categoria`);
    // Some events tell the same story in several ways (variants carry their own title and text).
    const told = item.variants?.length ? item.variants : [item];
    assert.ok(told.every(version => (version.title ?? item.title) && (version.body ?? item.body)), `${item.id}: titolo e testo`);
    assert.ok(Array.isArray(item.choices) && item.choices.length >= 2, `${item.id}: almeno due scelte`);
    const choiceIds = item.choices.map(choice => choice.id);
    assert.equal(new Set(choiceIds).size, choiceIds.length, `${item.id}: scelte con id distinti`);
    assert.ok(choiceIds.includes(item.defaultChoice), `${item.id}: la scelta predefinita esiste`);
    const fallback = item.choices.find(choice => choice.id === item.defaultChoice);
    assert.ok(!fallback.cost || !Object.values(fallback.cost).some(Boolean), `${item.id}: la scelta predefinita (che scatta a fine settimana) non costa nulla`);
    assert.ok(Number.isFinite(item.weight ?? 1) && (item.weight ?? 1) >= 0, `${item.id}: peso valido`);
    if (item.weight !== 0) assert.ok(Number.isInteger(item.cooldown ?? 8) && (item.cooldown ?? 8) >= 5, `${item.id}: cooldown di almeno cinque settimane`);
    if (item.days) assert.ok(item.days.length && item.days.every(day => Number.isInteger(day) && day >= 0 && day <= 6), `${item.id}: giorni preferiti validi`);
    if (item.when) assert.equal(typeof item.when === 'function' || typeof item.when === 'string', true, `${item.id}: condizione valida`);
    for (const text of [...told.flatMap(version => [version.title ?? item.title, version.body ?? item.body]), ...item.choices.map(choice => choice.label)]) for (const [, key] of String(text).matchAll(/\{(\w+)\}/g)) assert.ok(placeholders.has(key), `${item.id}: segnaposto sconosciuto {${key}}`);
    for (const choice of item.choices) {
      assert.ok(choice.label && choice.id, `${item.id}: scelta completa`);
      assert.ok(!/undefined|NaN|\[object/.test(describeEffects(choice.effects ?? {})), `${item.id}.${choice.id}: effetti leggibili`);
      for (const [metric] of Object.entries(choice.effects?.stats ?? {})) assert.ok(metric in STAT_LABELS, `${item.id}.${choice.id}: statistica ${metric}`);
      for (const [key] of Object.entries(choice.effects?.relations ?? {})) assert.ok(RELATION_TEMPLATES.some(entry => entry.id === key) || ['currentA', 'otherCurrents', 'target'].includes(key), `${item.id}.${choice.id}: rapporto ${key}`);
      if (choice.outcomes) assert.ok(Math.abs(choice.outcomes.reduce((sum, outcome) => sum + outcome.chance, 0) - 1) < 0.011, `${item.id}.${choice.id}: le probabilità degli esiti sommano a uno`);
      if (choice.followUp) { referenced.add(choice.followUp.id); assert.ok(byId[choice.followUp.id], `${item.id}: la catena ${choice.followUp.id} esiste`); assert.ok(choice.followUp.weeks >= 1 && choice.followUp.chance > 0 && choice.followUp.chance <= 1, `${item.id}: catena ben formata`); }
    }
  }
  // Chain ends exist only to be reached by a choice: nothing else raises them (weight 0) and something does lead to them.
  for (const item of POOL.filter(entry => entry.weight === 0)) if (!['congresso', 'presa-posizione'].includes(item.id)) assert.ok(referenced.has(item.id), `${item.id}: fine di catena senza nulla che porti a lei`);
  // A decision nobody takes ends with its default choice, which is applied without paying: it must cost nothing, for every
  // kind of decision the engine raises (events, appointments, urgent matters, the situations of the party, the Quirinale…).
  for (const [source, templates] of [['appuntamento', APPOINTMENTS], ['urgente', Object.values(FORCED_EVENTS)], ['situazione', Object.values(SITUATION_EVENTS)], ['vita del partito', Object.values(LIFE_SITUATIONS)], ['Quirinale', Object.values(PRESIDENCY_SITUATIONS)], ['partenza', Object.values(START_SITUATIONS)], ['obiettivi', Object.values(OBJECTIVE_SITUATIONS)]]) {
    for (const template of templates) {
      const fallback = template.choices.find(choice => choice.id === (template.defaultChoice ?? template.choices.at(-1).id));
      assert.ok(fallback, `${source} ${template.id}: la scelta predefinita esiste`);
      assert.ok(!fallback.cost || !Object.values(fallback.cost).some(Boolean), `${source} ${template.id}: la scelta predefinita costa nulla (${JSON.stringify(fallback.cost)})`);
    }
  }
  // The families: more than one event, and the events of a family belong to the same part of the story.
  const families = {};
  for (const item of POOL.filter(entry => entry.family)) (families[item.family] ??= []).push(item.id);
  assert.ok(Object.keys(families).length >= 12 && Object.values(families).every(list => list.length >= 2 || ['giunta', 'ordinanza', 'feste', 'delega', 'provincia', 'europa'].includes(Object.keys(families).find(key => families[key] === list))), 'Famiglie di eventi dello stesso genere');
  // No event may need a poll swing that the polls never produce, a trend of nothing: thresholds sit inside the real range.
  assert.ok(String(byId['crollo-sondaggi'].when).includes('pollTrend') && String(byId['exploit-sondaggi'].when).includes('pollTrend'), 'Le oscillazioni dei sondaggi si misurano sulla tendenza di un mese, non su un solo sondaggio');
}

// ---------- 2. who can live which event: the personas ----------
const STATS = { popularity: 45, reputation: 55, notoriety: 45, influence: 45, experience: 40 };
const fakeInstitution = (kind, playerRole, { leads = false, portfolio = false, groupLead = false } = {}) => ({ id: `${kind}-prova`, kind, status: 'active', playerRole, playerSide: 'maggioranza', ...(groupLead ? { playerGroupLead: true } : {}), executive: kind === 'europa' ? null : { leader: leads ? 'player' : 'simulato', members: [{ portfolio: 'Bilancio', groupId: 'g', holder: portfolio ? 'player' : 'simulato' }], stability: 60 } });
const parliamentFixture = ({ majority = true, minister = false, premier = false, governing = true } = {}) => ({
  player: { groupId: 'g1', chamber: 'camera', politicianId: 'p' },
  government: governing ? { status: 'active', primeMinister: premier ? 'player' : 'other', coalitionGroupIds: majority || premier ? ['g1', 'g2'] : ['g2'], supportingGroupIds: [], ministers: [{ id: 'm2', portfolio: 'Interno', groupId: 'g2' }, ...(minister ? [{ id: 'm1', portfolio: 'Salute', groupId: 'g1', playerAppointed: true }] : [])], stability: 55, partners: {} } : null,
  chambers: { camera: { groups: [{ groupId: 'g1', simulatedSeats: 120 }, { groupId: 'g2', simulatedSeats: 160 }] }, senato: { groups: [] } }, relations: { g1: { value: 55 }, g2: { value: 50 } }, laws: [], history: [], resources: { politicalCapital: 50 }, careerStanding: { partySupport: 50 }
});
const PERSONAS = [
  { id: 'cittadino', label: 'Senza partito né incarichi', party: null },
  { id: 'iscritto', label: 'Iscritto a un partito', party: { founder: false }, rank: 0 },
  { id: 'dirigente', label: 'Dirigente locale del partito', party: { founder: false }, rank: 2 },
  { id: 'direzione', label: 'Direzione nazionale', party: { founder: false }, rank: 3 },
  { id: 'segretario', label: 'Fondatore e segretario', party: { founder: true } },
  { id: 'segretario-eletto', label: 'Segretario eletto dal congresso', party: { founder: false }, rank: 5 },
  { id: 'consigliere-comunale', label: 'Consigliere comunale', level: 'comunale', party: { founder: false }, institutions: [fakeInstitution('comune', 'consigliere')] },
  { id: 'sindaco', label: 'Sindaco', level: 'comunale', party: { founder: false }, institutions: [fakeInstitution('comune', 'sindaco', { leads: true })] },
  { id: 'assessore-comunale', label: 'Assessore comunale', level: 'comunale', party: { founder: false }, institutions: [fakeInstitution('comune', 'assessore', { portfolio: true })] },
  { id: 'consigliere-provinciale', label: 'Consigliere provinciale', level: 'comunale', party: { founder: false }, institutions: [fakeInstitution('comune', 'consigliere'), fakeInstitution('provincia', 'consigliere')] },
  { id: 'presidente-provincia', label: 'Presidente della Provincia', level: 'comunale', party: { founder: false }, institutions: [fakeInstitution('comune', 'sindaco', { leads: true }), fakeInstitution('provincia', 'presidente', { leads: true })] },
  { id: 'consigliere-regionale', label: 'Consigliere regionale', level: 'regionale', party: { founder: false }, institutions: [fakeInstitution('regione', 'consigliere')] },
  { id: 'assessore-regionale', label: 'Assessore regionale', level: 'regionale', party: { founder: false }, institutions: [fakeInstitution('regione', 'assessore', { portfolio: true })] },
  { id: 'presidente-regione', label: 'Presidente di Regione', level: 'regionale', party: { founder: false }, institutions: [fakeInstitution('regione', 'presidente', { leads: true })] },
  { id: 'eurodeputato', label: 'Eurodeputato', level: 'europeo', party: { founder: false }, institutions: [fakeInstitution('europa', 'eurodeputato')] },
  { id: 'deputato-maggioranza', label: 'Deputato di maggioranza', level: 'deputato', party: { founder: false }, parliament: parliamentFixture() },
  { id: 'deputato-opposizione', label: 'Deputato di opposizione', level: 'deputato', party: { founder: false }, parliament: parliamentFixture({ majority: false }) },
  { id: 'senza-governo', label: 'Parlamentare senza governo in carica', level: 'deputato', party: { founder: false }, parliament: parliamentFixture({ governing: false }) },
  { id: 'ministro', label: 'Ministro', level: 'deputato', party: { founder: false }, parliament: parliamentFixture({ minister: true }) },
  { id: 'sottosegretario', label: 'Sottosegretario', level: 'deputato', party: { founder: false }, parliament: parliamentFixture(), flags: { scenarioOffice: { title: 'Sottosegretario (esecutivo di scenario)' } } },
  { id: 'premier', label: 'Presidente del Consiglio', level: 'deputato', party: { founder: true }, parliament: parliamentFixture({ premier: true }) },
  { id: 'segretario-parlamentare', label: 'Segretario con un seggio', level: 'deputato', party: { founder: true }, parliament: parliamentFixture() },
  { id: 'capogruppo', label: 'Capogruppo alla Camera', level: 'deputato', party: { founder: false }, parliament: parliamentFixture(), flags: { groupLeader: { groupId: 'g1', since: '2000-01-01' } } },
  { id: 'capogruppo-consiglio', label: 'Capogruppo in un consiglio comunale', level: 'comunale', party: { founder: false }, institutions: [fakeInstitution('comune', 'consigliere', { groupLead: true })] },
  { id: 'vicepremier', label: 'Segretario di un partito di coalizione e ministro', level: 'deputato', party: { founder: true }, parliament: parliamentFixture({ minister: true }) },
  // The local leaders of the party in the territory (committees with their leaders): a territory that slips away, one that is held, a secretary with ambitious local leaders.
  { id: 'iscritto-territorio-perso', label: 'Iscritto con i responsabili locali che non rispondono', party: { founder: false }, rank: 0, territory: 'sfugge' },
  { id: 'dirigente-territorio-compatto', label: 'Dirigente con i responsabili locali compatti', party: { founder: false }, rank: 2, territory: 'compatto' },
  { id: 'segretario-responsabili', label: 'Segretario con responsabili locali ambiziosi', party: { founder: false }, rank: 5, territory: 'ambiziosi' }
];
// A territory of crafted committees and leaders (the committees of the home region with their local leaders, as the internal life keeps them).
const UNITS = [{ code: '052', name: 'Siena', type: 'Provincia', gameRegion: 'Toscana', municipalities: 36 }, { code: '051', name: 'Arezzo', type: 'Provincia', gameRegion: 'Toscana', municipalities: 36 }];
function craftTerritory(game, kind) {
  const org = game.party.org;
  let n = 7; const rand = () => { n = (n * 1103515245 + 12345) % 2147483648; return n / 2147483648; };
  org.committees = createCommittees(org, { region: 'Toscana', units: UNITS, home: { municipality: 'Siena', municipalityCode: '052032', provinceCode: '052' }, currents: game.party.currents, rank: game.party.rank, founder: false, week: 1, rand }).filter(item => item.region === 'Toscana');
  const ruling = game.party.currents[0].id;
  game.party.alignedCurrentId = ruling;
  const cadres = [];
  for (const committee of org.committees) {
    if (committee.leader.player) continue;
    const mine = kind !== 'sfugge';
    committee.leader = { label: 'Dirigente locale (figura simulata)', currentId: mine ? ruling : game.party.currents[1].id, player: false, since: 1 };
    committee.loyalty = mine ? 88 : 28; committee.autonomy = mine ? 25 : 78; committee.status = 'consolidamento';
    cadres.push({ id: `quadro-${committee.id}`, committeeId: committee.id, region: committee.region, level: committee.level, name: committee.name, label: committee.leader.label, currentId: committee.leader.currentId, player: false, interest: 'seggio', ambition: kind === 'ambiziosi' ? 75 : 40, loyalty: mine ? 88 : 28, grievance: mine ? 10 : 65, status: mine ? 'attivo' : 'critico', sinceWeek: 1, lastActWeek: null, nextActWeek: 99, leaderKey: `${committee.leader.currentId}|${committee.leader.label}|0|1`, source: 'simulation' });
  }
  game.party.life.cadres = cadres;
}
const signalsFor = (date, extra = {}) => ({ crime: 50, perceived: 50, spread: 150, euStatus: 'regolare', stability: 60, ministers: 0, majorityMood: 55, regions: [], partyGoverning: false, neighbours: [], ...seasons(date), ...extra });
function gameOf(persona, seed = 'eventi') {
  const game = createGameState({ seedText: `${seed}|${persona.id}`, currentDate: START, level: persona.level ?? 'deputato', party: persona.party ? { id: 'partito-prova', label: 'Partito di prova', ...persona.party } : null, place: { region: 'Toscana', municipality: 'Siena' }, stats: STATS });
  if (persona.rank !== undefined && game.party) { game.party.rank = persona.rank; }
  if (persona.flags) game.flags = { ...game.flags, ...persona.flags };
  if (persona.territory) craftTerritory(game, persona.territory);
  return game;
}
const envOf = (persona, date, extra = {}) => ({ currentDate: date, career: { currentLevel: persona.level ?? null }, offices: [], player: null, institutions: persona.institutions ?? [], signals: signalsFor(date, extra.signals), ...extra.env });
// Situations of the same persona under many signals: the seasons, the markets, an election, the polls, the party's health.
const VARIANTS = [
  { name: 'base' }, { name: 'estate', date: '2027-07-12' }, { name: 'autunno', date: '2027-10-11' }, { name: 'inverno', date: '2027-01-18' },
  { name: 'mercati in tensione', signals: { spread: 260, euStatus: 'procedura', stability: 30 } }, { name: 'richiamo europeo', signals: { spread: 230, euStatus: 'richiamo' } },
  { name: 'maggioranza fragile', signals: { stability: 30, majorityMood: 30, lawAtVote: true, openLawInCommission: true, ministers: 3 } }, { name: 'voto vicino', signals: { electionSoon: true } },
  { name: 'sondaggi in calo', env: { pollTrend: -1.4, pollDelta: -0.5, pollShare: 8 } }, { name: 'sondaggi in crescita', env: { pollTrend: 1.4, pollDelta: 0.5, pollShare: 8 } },
  { name: 'partito piccolo', env: { pollShare: 2.5 } }, { name: 'partito grande', env: { pollShare: 18 } }, { name: 'memoria pesante', signals: { memoryRecall: 'Una promessa mancata', memoryPressure: 3, pendingPressure: 3 } },
  { name: 'territorio in difficoltà', signals: { regions: [{ name: 'Toscana', indicators: { economia: 35, occupazione: 38, servizi: 40, sanita: 38, istruzione: 45, infrastrutture: 40, trasporti: 38, sicurezza: 40, ambiente: 45 } }] } },
  { name: 'territorio in salute', signals: { regions: [{ name: 'Toscana', indicators: { economia: 75, occupazione: 72, servizi: 72, sanita: 70, istruzione: 70, infrastrutture: 70, trasporti: 70, sicurezza: 70, ambiente: 70 } }] } },
  { name: 'memoria e voto', signals: { memoryRecall: 'Una promessa mancata', memoryPressure: 3, electionSoon: true } },
  { name: 'partito diviso', signals: { cohesion: 38 }, hostile: true, mutate: game => { game.party.org.cohesion = 38; } },
  { name: 'una federazione in crisi', mutate: game => { game.party.org.sections[0].vitality = 18; } },
  { name: 'partito di centro', signals: { partyAxis: 0 } },
  { name: 'rapporti civici forti', mutate: game => { for (const item of game.relations) if (item.id === 'civic') item.value = 72; } },
  { name: 'campagna', env: { campaign: { status: 'active' } } }, { name: 'correnti ostili', hostile: true }, { name: 'notorietà alta', stats: { notoriety: 85, reputation: 70, influence: 70, experience: 70 } }, { name: 'notorietà bassa', stats: { notoriety: 8, reputation: 40, influence: 20, experience: 20 } }
];
function sitOf(persona, variant = {}) {
  const date = variant.date ?? START;
  const game = gameOf(persona);
  if (variant.hostile && game.party) for (const current of game.party.currents) { current.value = 20; current.relation = 20; }
  if (variant.mutate && (game.party || !variant.mutate.toString().includes('game.party'))) variant.mutate(game);
  const stats = { ...STATS, ...(variant.stats ?? {}) };
  const env = envOf(persona, date, variant);
  return situation({ game, stats, parliament: persona.parliament ? JSON.parse(JSON.stringify(persona.parliament)) : null }, env);
}
const eligibility = new Map(POOL.map(item => [item.id, new Set()]));
const baseEligible = new Map();
const times = new Map(POOL.map(item => [item.id, 0]));
for (const persona of PERSONAS) {
  const ids = [];
  for (const variant of VARIANTS) {
    const sit = sitOf(persona, variant);
    for (const item of POOL) if (item.weight > 0 && meets(item.when, sit)) { eligibility.get(item.id).add(persona.id); times.set(item.id, times.get(item.id) + 1); if (variant.name === 'base') ids.push(item.id); }
  }
  baseEligible.set(persona.id, new Set(ids));
}
{
  // The offices are read from the institutions, not from a label.
  assert.deepEqual(localOffices([fakeInstitution('comune', 'sindaco', { leads: true }), fakeInstitution('provincia', 'presidente', { leads: true })]), { comune: 'sindaco', provincia: 'presidente-provincia', regione: null, europa: null });
  assert.equal(sitOf(PERSONAS.find(item => item.id === 'sindaco')).holds('sindaco'), true);
  assert.equal(sitOf(PERSONAS.find(item => item.id === 'assessore-comunale')).role.assessor, true);
  assert.equal(sitOf(PERSONAS.find(item => item.id === 'consigliere-provinciale')).role.provincial, true);
  assert.equal(sitOf(PERSONAS.find(item => item.id === 'eurodeputato')).role.europarl, true);
  assert.equal(sitOf(PERSONAS.find(item => item.id === 'capogruppo')).role.groupLeader, true, 'Il capogruppo si legge dal gruppo del seggio');
  assert.equal(sitOf(PERSONAS.find(item => item.id === 'deputato-maggioranza')).role.groupLeader, false);
  assert.equal(sitOf(PERSONAS.find(item => item.id === 'capogruppo-consiglio')).role.groupLeader, true, 'Il capogruppo in consiglio si legge dall’istituzione');
  assert.equal(sitOf(PERSONAS.find(item => item.id === 'vicepremier')).role.deputyPremier, true, 'Il segretario ministro di un partito di coalizione è vicepremier');
  assert.equal(sitOf(PERSONAS.find(item => item.id === 'ministro')).role.deputyPremier, false, 'Un ministro senza guida di partito non è vicepremier');
  assert.equal(sitOf(PERSONAS.find(item => item.id === 'premier')).role.deputyPremier, false, 'Il premier non è vicepremier');
  // Every event can happen to someone (a threshold the simulation never reaches is a dead event).
  const dead = POOL.filter(item => item.weight > 0 && !eligibility.get(item.id).size).map(item => item.id);
  assert.deepEqual(dead, [], `Eventi che non possono mai accadere: ${dead.join(', ')}`);
  // None is always eligible, apart from the quiet fillers (and the rare shocks that touch everyone).
  const everyone = POOL.filter(item => item.weight > 0 && times.get(item.id) === PERSONAS.length * VARIANTS.length).map(item => item.id);
  const allowed = everyone.filter(id => byId[id].category === 'quiete' || byId[id].rare || byId[id].category === 'emergenza');
  assert.deepEqual(everyone.filter(id => !allowed.includes(id)), [], `Eventi eleggibili per chiunque, senza contesto: ${everyone.filter(id => !allowed.includes(id)).join(', ')}`);
  // The roles have events of their own: what is eligible for a mayor is not what is eligible for a Minister.
  const shares = { sindaco: ['presidente-provincia'], 'consigliere-provinciale': ['presidente-provincia'], 'assessore-comunale': ['assessore-regionale'] };
  const only = persona => [...baseEligible.get(persona)].filter(id => PERSONAS.filter(other => other.id !== persona && !(shares[persona] ?? []).includes(other.id)).every(other => !baseEligible.get(other.id).has(id)));
  for (const persona of ['sindaco', 'assessore-comunale', 'consigliere-provinciale', 'eurodeputato']) assert.ok(only(persona).length >= 1, `${persona}: ha eventi che nessun altro ruolo vive (${only(persona).join(', ')})`);
  assert.ok(![...baseEligible.get('cittadino')].some(id => ['giunta-spaccata', 'delega-sotto-attacco', 'sindaci-fondi-strade', 'voto-sensibile-gruppo', 'question-time', 'ministro-gaffe'].includes(id)), 'Chi non ha incarichi non vive gli eventi di un incarico');
  for (const persona of PERSONAS) {
    const count = baseEligible.get(persona.id).size;
    assert.ok(count >= (persona.id === 'cittadino' ? 5 : 9), `${persona.id}: abbastanza eventi possibili (${count})`);
  }
  // The signals that count are the ones the event reads: a poll swing needs a month of trend, not a noisy poll.
  const sit = sitOf(PERSONAS.find(item => item.id === 'iscritto'), { env: { pollTrend: -1.4, pollShare: 8 } });
  assert.ok(meets(byId['crollo-sondaggi'].when, sit) && !meets(byId['exploit-sondaggi'].when, sit), 'Un mese di calo apre la crisi dei sondaggi, non l’exploit');
  assert.ok(!meets(byId['crollo-sondaggi'].when, sitOf(PERSONAS.find(item => item.id === 'iscritto'), { env: { pollDelta: -0.5, pollTrend: 0, pollShare: 8 } })), 'Una sola rilevazione negativa non basta');
}

// ---------- 3. the weeks: frequency, budget, cooldowns, families, categories ----------
const WEEKS = 104;
function playPersona(persona, seed = 'storia', { weeks = WEEKS, decide = true } = {}) {
  let game = gameOf(persona, seed);
  let stats = { ...STATS };
  let parliament = persona.parliament ? JSON.parse(JSON.stringify(persona.parliament)) : null;
  let date = START;
  const choose = rander(`${seed}|${persona.id}|scelte`);
  const raised = [];
  const weekly = [];
  for (let week = 0; week < weeks; week++) {
    date = addDays(date, 7);
    const env = envOf(persona, date);
    const result = advanceWeek({ game, stats, parliament }, env, value => value);
    game = result.ctx.game; stats = result.ctx.stats; parliament = result.ctx.parliament;
    stats.reputation = Math.max(stats.reputation, 40); game.status = 'active'; game.resources.politicalCapital = Math.max(game.resources.politicalCapital, 30);
    const now = game.inbox.filter(item => item.week === game.week.index);
    const events = now.filter(item => item.kind === 'evento');
    for (const item of events) raised.push({ id: item.templateId, week: game.week.index, chain: Boolean(item.chain), day: item.day, category: item.category ?? byId[item.templateId]?.category ?? null, important: isImportant(byId[item.templateId] ?? {}) });
    const ordinary = events.filter(item => !item.chain && !isImportant(byId[item.templateId] ?? {}) && item.templateId !== 'presa-posizione');
    weekly.push({ week: game.week.index, events: events.length, ordinary: ordinary.length, important: events.filter(item => !item.chain && isImportant(byId[item.templateId] ?? {})).length, categories: ordinary.map(item => byId[item.templateId]?.category), appointments: now.filter(item => item.kind === 'appuntamento').length, desk: game.inbox.length });
    if (decide) for (const item of [...game.inbox]) if (choose() < 0.5) { try { const done = resolveInboxItem({ game, stats, parliament }, env, item.id, item.choices[Math.floor(choose() * item.choices.length)].id); game = done.ctx.game; stats = done.ctx.stats; parliament = done.ctx.parliament; } catch { /* not affordable this week */ } }
  }
  return { raised, weekly, game };
}
const runs = new Map(PERSONAS.map(persona => [persona.id, playPersona(persona)]));
{
  const repeat = playPersona(PERSONAS.find(item => item.id === 'sindaco'));
  assert.deepEqual(repeat.raised.map(item => `${item.id}@${item.week}/${item.day}`), runs.get('sindaco').raised.map(item => `${item.id}@${item.week}/${item.day}`), 'Determinismo: stesso seme e stesse scelte, stessi eventi');
  assert.notDeepEqual(playPersona(PERSONAS.find(item => item.id === 'sindaco'), 'altra').raised.map(item => item.id), runs.get('sindaco').raised.map(item => item.id), 'Un altro seme racconta un’altra storia');
  for (const persona of PERSONAS) {
    const { raised, weekly } = runs.get(persona.id);
    const label = persona.id;
    // Frequency: the ordinary events of the week follow the budget and are balanced (not 3 a week, not none for years).
    const ordinary = average(weekly.map(week => week.ordinary));
    assert.ok(ordinary >= (persona.id === 'cittadino' ? 0.25 : 0.55) && ordinary <= 1.6, `${label}: eventi ordinari a settimana nella misura (${ordinary.toFixed(2)})`);
    assert.ok(weekly.every(week => week.ordinary <= AGENDA_CAPS.tenseEvents) && weekly.filter(week => week.ordinary >= AGENDA_CAPS.tenseEvents).length <= WEEKS * 0.08, `${label}: tetto degli eventi ordinari, e il terzo solo nelle settimane tese`);
    assert.ok(weekly.every(week => week.important <= AGENDA_CAPS.important), `${label}: pochi eventi importanti insieme`);
    assert.ok(weekly.every(week => week.appointments <= AGENDA_CAPS.appointments), `${label}: un solo appuntamento a settimana`);
    assert.ok(weekly.every(week => new Set(week.categories).size === week.categories.length), `${label}: mai due eventi ordinari della stessa categoria nella stessa settimana`);
    assert.ok(Math.max(...weekly.map(week => week.events)) <= 5, `${label}: nessuna valanga di eventi (${Math.max(...weekly.map(week => week.events))})`);
    assert.ok(weekly.filter(week => week.events === 0).length <= WEEKS * 0.45, `${label}: il mondo non resta fermo per mesi`);
    // Cooldowns and families: strict between draws (a chain follows its own, shorter clock).
    const last = new Map();
    const lastFamily = new Map();
    for (const item of raised) {
      const event = byId[item.id];
      if (last.has(item.id)) { const gap = item.week - last.get(item.id).week; assert.ok(gap >= (item.chain || last.get(item.id).chain ? Math.min(event.cooldown ?? 8, 4) : event.cooldown ?? 8), `${label}: ${item.id} dopo ${gap} settimane (cooldown ${event.cooldown ?? 8})`); }
      last.set(item.id, item);
      if (event?.family && !item.chain) {
        if (lastFamily.has(event.family) && lastFamily.get(event.family).id !== item.id) { const gap = item.week - lastFamily.get(event.family).week; assert.ok(gap >= AGENDA_CAPS.familyGapWeeks - 1, `${label}: ${item.id} dopo ${lastFamily.get(event.family).id} della stessa famiglia (${event.family}) in ${gap} settimane`); }
        lastFamily.set(event.family, item);
      }
      if (event?.unique) assert.equal(raised.filter(entry => entry.id === item.id).length, 1, `${label}: ${item.id} accade una volta sola`);
    }
    // Variety and balance: no event takes more than a tenth of the story, categories mix, the pool is used.
    const counts = {};
    for (const item of raised) counts[item.id] = (counts[item.id] ?? 0) + 1;
    const top = Math.max(...Object.values(counts));
    assert.ok(top <= Math.max(4, raised.length * 0.12), `${label}: nessun evento troppo ricorrente (il più frequente ${top} su ${raised.length})`);
    assert.ok(Object.keys(counts).length >= (persona.id === 'cittadino' ? 8 : 14), `${label}: varietà (${Object.keys(counts).length} eventi diversi in due anni)`);
    assert.ok(new Set(raised.map(item => item.category)).size >= (persona.id === 'cittadino' ? 4 : 7), `${label}: categorie diverse (${new Set(raised.map(item => item.category)).size})`);
    // The days are a preference: every event and appointment lands on a day, and no event keeps the same weekday.
    assert.ok(raised.every(item => Number.isInteger(item.day)), `${label}: ogni evento cade in un giorno`);
  }
  // Across the personas: the daily catalogue is truly used, the days are spread, an event does not sit on one weekday.
  const all = [...runs.values()].flatMap(run => run.raised);
  const daily = all.filter(item => DAILY_EVENTS.some(entry => entry.id === item.id)).length;
  assert.ok(daily >= all.length * 0.4 && daily <= all.length * 0.85, `Gli eventi giornalieri pesano nella misura (${Math.round(daily / all.length * 100)}%)`);
  const byDay = [0, 1, 2, 3, 4, 5, 6].map(day => all.filter(item => item.day === day).length);
  assert.ok(byDay.every(count => count > 0) && Math.max(...byDay) <= all.length * 0.3, `Nessun giorno raccoglie più del 30% degli eventi (${byDay.join('/')})`);
  assert.ok(byDay[5] + byDay[6] > 0 && byDay.slice(0, 5).every(count => count > byDay[6]), 'I giorni feriali sono preferiti, il fine settimana non è escluso');
  for (const id of Object.keys(byId)) {
    const seen = all.filter(item => item.id === id);
    if (seen.length >= 25 && byId[id].days) assert.ok(new Set(seen.map(item => item.day)).size >= 3, `${id}: non è legato a un giorno fisso (${[...new Set(seen.map(item => item.day))].join(',')})`);
  }
  assert.equal(eventDay(['x'].slice(1), 0.5), eventDay(undefined, 0.5), 'Senza preferenze ogni giorno è possibile');
  const hits = new Set(Array.from({ length: 200 }, (_, index) => eventDay([2, 3], index / 200)));
  assert.equal(hits.size, 7, 'Anche un evento che preferisce due giorni può cadere in ogni altro giorno');
  // Reachability in practice: what the situation makes possible is raised, not only listed.
  const raisedIds = new Set(all.map(item => item.id));
  const reachable = POOL.filter(item => item.weight > 0 && PERSONAS.some(persona => baseEligible.get(persona.id).has(item.id)));
  const unused = reachable.filter(item => !raisedIds.has(item.id)).map(item => item.id);
  assert.ok(unused.length <= reachable.length * 0.12, `Quasi tutti gli eventi possibili accadono (${unused.length} su ${reachable.length} mai visti: ${unused.slice(0, 12).join(', ')})`);
}

// ---------- 4. the important ones are not crowded out by the ordinary ones ----------
{
  const weeks = [...runs.values()].flatMap(run => run.weekly);
  const rate = (list, key) => list.filter(week => week[key] > 0).length / Math.max(1, list.length);
  const withOrdinary = weeks.filter(week => week.ordinary > 0);
  const withoutOrdinary = weeks.filter(week => week.ordinary === 0);
  assert.ok(withOrdinary.length > 200 && withoutOrdinary.length > 200, 'Settimane con e senza eventi ordinari');
  // The ordinary events never take the place of an important one: an important event is drawn on its own, before them (a busy
  // desk, on the contrary, takes no new ordinary event, so the weeks without ordinary events are the ones with a crisis).
  assert.ok(rate(withOrdinary, 'important') >= rate(weeks, 'important') - 0.05, `Avere eventi ordinari non toglie spazio a crisi, emergenze e scandali (${rate(withOrdinary, 'important').toFixed(3)} con, ${rate(withoutOrdinary, 'important').toFixed(3)} senza, ${rate(weeks, 'important').toFixed(3)} in tutto)`);
  for (const persona of PERSONAS.filter(item => ['sindaco', 'deputato-maggioranza', 'presidente-regione', 'segretario'].includes(item.id))) {
    const own = runs.get(persona.id).weekly;
    assert.ok(rate(own, 'important') >= 0.08 && rate(own, 'important') <= 0.4, `${persona.id}: crisi, emergenze e scandali con la loro frequenza (${rate(own, 'important').toFixed(3)})`);
  }
  const importantRate = weeks.filter(week => week.important > 0).length / weeks.length;
  assert.ok(importantRate >= 0.08 && importantRate <= 0.4, `Crisi, emergenze e scandali con una frequenza propria (${importantRate.toFixed(3)} a settimana)`);
  // A person with something to answer for lives more of them than one with nothing.
  const holders = ['sindaco', 'presidente-regione', 'ministro', 'premier'].flatMap(id => runs.get(id).raised.filter(item => item.important));
  const citizen = runs.get('cittadino').raised.filter(item => item.important);
  assert.ok(holders.length > citizen.length * 2, `Chi governa vive più crisi di chi non ha incarichi (${holders.length} contro ${citizen.length})`);
}

// ---------- 5. the political world asks for a position only when it concerns the player ----------
{
  const reactionsFor = (persona, scope, seed = 'reazioni') => {
    let game = gameOf(persona, seed);
    const sit = () => sitOf(persona, {});
    let count = 0;
    const weeksBetween = [];
    let lastWeek = null;
    for (let week = 0; week < 156; week++) {
      game = JSON.parse(JSON.stringify(game));
      game.week.index = week + 1; game.inbox = [];
      const before = game.inbox.length;
      game = addWorldReaction(game, { eventId: 'x', title: 'Un fatto', body: 'Un fatto del mondo', scope }, sit());
      if (game.inbox.length > before) { count += 1; if (lastWeek !== null) weeksBetween.push(week - lastWeek); lastWeek = week; game.lastReactionWeek = game.lastReactionWeek ?? week + 1; }
    }
    return { count, weeksBetween };
  };
  const secretary = reactionsFor(PERSONAS.find(item => item.id === 'segretario'), 'nazionale');
  const citizen = reactionsFor(PERSONAS.find(item => item.id === 'cittadino'), 'nazionale');
  const councillor = reactionsFor(PERSONAS.find(item => item.id === 'consigliere-comunale'), 'nazionale');
  const councillorLocal = reactionsFor(PERSONAS.find(item => item.id === 'consigliere-comunale'), 'locale');
  assert.ok(secretary.count > councillor.count && councillor.count >= citizen.count, `Un fatto nazionale riguarda chi guida più di chi ha un incarico locale e più di chi non ne ha (${secretary.count}/${councillor.count}/${citizen.count})`);
  assert.ok(councillorLocal.count > councillor.count, `Un fatto locale riguarda il consigliere comunale più di uno nazionale (${councillorLocal.count} contro ${councillor.count})`);
  assert.ok(secretary.weeksBetween.every(gap => gap >= AGENDA_CAPS.reactionGapWeeks), `Mai due richieste di una presa di posizione a meno di ${AGENDA_CAPS.reactionGapWeeks} settimane`);
  assert.ok(secretary.count <= 156 / AGENDA_CAPS.reactionGapWeeks + 1, 'Al massimo una richiesta ogni pochi mesi anche per chi guida un partito');
  const sit = sitOf(PERSONAS.find(item => item.id === 'presidente-regione'), {});
  assert.ok(reactionRelevance({ scope: 'regionale' }, sit) > reactionRelevance({ scope: 'nazionale' }, sit) && reactionRelevance({ scope: 'locale' }, sit) < reactionRelevance({ scope: 'regionale' }, sit), 'Per chi governa la Regione conta soprattutto ciò che accade in Regione');
  // Never above the week's cap: a week already full of ordinary events takes no reaction.
  const full = gameOf(PERSONAS.find(item => item.id === 'segretario'));
  full.inbox = [{ id: 'a', kind: 'evento', templateId: 'protesta', category: 'territorio', week: 1 }, { id: 'b', kind: 'evento', templateId: 'rivale', category: 'partito', week: 1 }];
  assert.equal(addWorldReaction(full, { title: 'x', body: 'y', scope: 'nazionale' }, sitOf(PERSONAS.find(item => item.id === 'segretario'), {})).inbox.length, 2, 'Con il tetto degli eventi ordinari pieno la richiesta non si aggiunge');
}

const ordinaryAverage = average([...runs.values()].flatMap(run => run.weekly.map(week => week.ordinary)));
const importantAverage = average([...runs.values()].flatMap(run => run.weekly.map(week => week.important)));
console.log(`Eventi verificati: ${POOL.length} eventi (${DAILY_EVENTS.length} giornalieri, ${CAREER_EVENTS.length} procedurali) con condizioni leggibili, nessuno sempre eleggibile o impossibile, ${PERSONAS.length} ruoli con gli eventi del proprio incarico, ${ordinaryAverage.toFixed(2)} eventi ordinari e ${importantAverage.toFixed(2)} importanti a settimana nei ${WEEKS} turni di ogni ruolo, cooldown e famiglie rispettati, giorno della settimana solo come preferenza, importanti non soffocati dagli ordinari, richieste di presa di posizione solo se riguardano il ruolo.`);
