// Cariche e ruoli: ogni carica ha poteri, doveri e rischi suoi e la partita li legge dal seggio che il giocatore occupa
// davvero (non da un’etichetta). Consigliere, assessore e sindaco (o presidente della Provincia e della Regione) non fanno le
// stesse cose; il capogruppo e il vicepremier esistono come cariche; le combinazioni incompatibili sono impedite alla
// candidatura o sciolte a favore della carica nuova, con la regola che si applica. Qui: il catalogo, le incompatibilità e le
// basi (provincia), i poteri dei ruoli locali sul motore, la delega dell’assessore (valutazione, revoca), il capogruppo,
// la Provincia come livello e le candidature sul motore vero.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const R = await module('src/data/simulation/office-rules.js');
const O = await module('src/core/office-engine.js');
const L = await module('src/core/local-engine.js');
const { seededRandom } = await module('src/core/vote-engine.js');
const { advanceDays } = await module('src/core/time.js');
const { playerRoles, heldOfficesOf } = await module('src/core/roles.js');
const { renderRolesPanel } = await module('src/ui/game-mode.js');
const { renderInstitutions } = await module('src/ui/local-mode.js');
const { checkInvariants } = await module('src/core/invariants.js');
const clean = (html, where) => { const bad = html.replace(/data-[a-z-]+="[^"]*"/g, '').match(/.{0,60}(undefined|NaN|\[object Object\]|Infinity).{0,60}/); assert.ok(!bad, `${where}: valori non validi (${bad?.[0]})`); };

// ---------- 1. il catalogo ----------
{
  const ids = Object.keys(R.OFFICES);
  for (const id of ['consigliere-comunale', 'assessore-comunale', 'sindaco', 'consigliere-provinciale', 'assessore-provinciale', 'presidente-provincia', 'consigliere-regionale', 'assessore-regionale', 'presidente-regione', 'deputato', 'senatore', 'capogruppo', 'eurodeputato', 'sottosegretario', 'ministro', 'vicepremier', 'premier', 'segretario', 'presidente-repubblica']) assert.ok(R.OFFICES[id], `Carica nel catalogo: ${id}`);
  for (const id of ids) {
    const office = R.OFFICES[id];
    assert.ok(office.label && R.OFFICE_SCOPES[office.scope] && Number.isFinite(office.tier) && office.kind, `${id}: etichetta, ambito, peso e tipo`);
    assert.ok(office.powers.every(power => R.POWERS[power]), `${id}: solo poteri noti`);
    assert.ok(office.risks.length >= 1 && office.duties.length >= 1, `${id}: ogni carica ha doveri e rischi`);
  }
  // Una carica pesa più di quella da cui di solito si sale (la scala delle cariche).
  const ladder = ['consigliere-comunale', 'assessore-comunale', 'consigliere-regionale', 'sindaco', 'presidente-regione', 'deputato', 'ministro', 'vicepremier', 'premier', 'presidente-repubblica'];
  assert.deepEqual([...ladder].sort((a, b) => R.OFFICES[a].tier - R.OFFICES[b].tier), ladder, 'La scala dei pesi segue la scala delle cariche');
  // Cariche diverse, poteri diversi: nello stesso ente consigliere, assessore e capo dell’esecutivo non coincidono.
  for (const group of [['consigliere-comunale', 'assessore-comunale', 'sindaco'], ['consigliere-provinciale', 'assessore-provinciale', 'presidente-provincia'], ['consigliere-regionale', 'assessore-regionale', 'presidente-regione'], ['deputato', 'capogruppo'], ['ministro', 'vicepremier', 'premier']]) {
    const sets = group.map(id => [...R.OFFICES[id].powers].sort().join('|'));
    assert.equal(new Set(sets).size, group.length, `Poteri distinti: ${group.join(', ')}`);
  }
  assert.ok(R.OFFICES.sindaco.powers.includes('taxes') && R.OFFICES['presidente-regione'].powers.includes('taxes') && !R.OFFICES['presidente-provincia'].powers.includes('taxes'), 'I tributi sono del Comune e della Regione, non della Provincia');
  assert.ok(R.OFFICES['presidente-provincia'].powers.includes('assembly-of-mayors') && !R.OFFICES.sindaco.powers.includes('assembly-of-mayors'), 'L’Assemblea dei sindaci è del Presidente della Provincia');
  assert.ok(!R.OFFICES['assessore-comunale'].powers.includes('questions') && R.OFFICES['consigliere-comunale'].powers.includes('questions'), 'L’assessore non interroga la giunta di cui fa parte');
  assert.ok(R.OFFICES['assessore-comunale'].powers.includes('delega-acts') && !R.OFFICES['consigliere-comunale'].powers.includes('delega-acts'));
  // Ogni potere è dato da almeno una carica.
  for (const power of Object.keys(R.POWERS)) assert.ok(ids.some(id => R.OFFICES[id].powers.includes(power)), `Potere senza carica: ${power}`);
  for (const rule of R.INCOMPATIBILITIES) assert.ok([...rule.a, ...rule.b].every(id => R.OFFICES[id]) && rule.rule, `Incompatibilità ${rule.id}: cariche note e regola dichiarata`);
  for (const [id, base] of Object.entries(R.OFFICE_BASES)) assert.ok(R.OFFICES[id] && base.anyOf.every(other => R.OFFICES[other]), `Base di ${id}`);
  for (const [type, roles] of Object.entries(R.OFFICE_OF_CANDIDACY)) for (const office of Object.values(roles)) assert.ok(R.OFFICES[office], `Candidatura ${type} → ${office}`);
  for (const [kind, portfolios] of Object.entries(R.PORTFOLIO_AREAS)) for (const name of INSTITUTION_PORTFOLIOS(kind)) assert.ok(portfolios[name]?.length, `Ogni delega ${kind}/${name} ha dei temi`);
}
function INSTITUTION_PORTFOLIOS(kind) { return L.INSTITUTIONS[kind].portfolios; }

// ---------- 2. le cariche che si hanno ----------
const fake = (kind, extra = {}) => ({ id: `${kind}-x`, kind, status: 'active', playerRole: 'consigliere', executive: kind === 'europa' ? null : { leader: 'simulato', members: [] }, ...extra });
{
  assert.deepEqual(O.heldOffices({ institutions: [fake('comune'), fake('provincia')] }), ['consigliere-provinciale', 'consigliere-comunale']);
  assert.deepEqual(O.heldOffices({ institutions: [fake('comune', { executive: { leader: 'player', members: [] } }), fake('provincia', { executive: { leader: 'player', members: [] } })] }), ['sindaco', 'presidente-provincia']);
  assert.deepEqual(O.heldOffices({ institutions: [fake('comune', { playerRole: 'assessore' })] }), ['assessore-comunale']);
  assert.deepEqual(O.heldOffices({ institutions: [fake('regione')], secretary: true }), ['segretario', 'consigliere-regionale']);
  assert.deepEqual(O.heldOffices({ chamber: 'senato', groupLeader: true }), ['capogruppo', 'senatore']);
  assert.deepEqual(O.heldOffices({ chamber: 'camera' }), ['deputato'], 'Senza gruppo non c’è un capogruppo');
  assert.ok(!O.heldOffices({ groupLeader: true }).includes('capogruppo'), 'Il capogruppo è un parlamentare');
  assert.deepEqual(O.heldOffices({ chamber: 'camera', minister: true }), ['ministro', 'deputato']);
  assert.deepEqual(O.heldOffices({ chamber: 'camera', minister: true, secretary: true, inMajority: true }), ['vicepremier', 'ministro', 'deputato', 'segretario'], 'Il leader di un partito di coalizione al governo è vicepremier');
  assert.ok(!O.heldOffices({ chamber: 'camera', minister: true, secretary: true, inMajority: false }).includes('vicepremier'), 'Senza la maggioranza non c’è vicepresidenza');
  assert.deepEqual(O.heldOffices({ chamber: 'camera', premier: true, minister: true, secretary: true, inMajority: true }), ['premier', 'deputato', 'segretario'], 'Il premier non è ministro né vicepremier');
  assert.deepEqual(O.heldOffices({ chamber: 'camera', undersecretary: true }), ['sottosegretario', 'deputato']);
  assert.deepEqual(O.heldOffices({ president: true }), ['presidente-repubblica']);
  assert.deepEqual(O.heldOffices({ institutions: [fake('comune', { status: 'concluso' })] }), [], 'Un’istituzione conclusa non dà cariche');
  assert.ok(O.heldOffices({ institutions: [fake('comune', { playerGroupLead: true })] }).includes('capogruppo-consiliare'));
  assert.ok(O.hasPower(['sindaco'], 'giunta') && !O.hasPower(['consigliere-comunale'], 'giunta') && !O.hasPower(['assessore-comunale'], 'giunta'));
}

// ---------- 3. le incompatibilità ----------
{
  const bad = (held, office) => O.incompatibleWith(held, office).map(item => item.office).sort();
  // Costituzione, art. 122: Regione e Camere, Regione e Parlamento europeo; il mandato europeo e quello nazionale.
  assert.deepEqual(bad(['consigliere-regionale'], 'deputato'), ['consigliere-regionale']);
  assert.deepEqual(bad(['senatore'], 'presidente-regione'), ['senatore']);
  assert.deepEqual(bad(['assessore-regionale'], 'eurodeputato'), ['assessore-regionale']);
  assert.deepEqual(bad(['deputato'], 'eurodeputato'), ['deputato']);
  assert.deepEqual(bad(['deputato'], 'senatore'), ['deputato'], 'Non si siede in due Camere');
  assert.deepEqual(bad(['ministro'], 'eurodeputato'), ['ministro']);
  assert.deepEqual(bad(['ministro'], 'consigliere-regionale'), ['ministro']);
  assert.deepEqual(bad(['sottosegretario'], 'sindaco'), ['sottosegretario'], 'Chi governa non guida un ente locale');
  assert.deepEqual(bad(['premier'], 'assessore-comunale'), ['premier']);
  assert.deepEqual(bad(['sindaco'], 'deputato'), ['sindaco'], 'Sindaco e mandato parlamentare non si cumulano');
  assert.deepEqual(bad(['presidente-provincia'], 'senatore'), ['presidente-provincia']);
  assert.deepEqual(bad(['sindaco'], 'consigliere-regionale'), ['sindaco']);
  assert.deepEqual(bad(['presidente-regione'], 'assessore-comunale'), ['presidente-regione']);
  assert.deepEqual(bad(['deputato', 'capogruppo'], 'consigliere-regionale'), ['capogruppo', 'deputato']);
  // Combinazioni compatibili: lo sono davvero.
  for (const [held, office] of [[['consigliere-comunale'], 'consigliere-provinciale'], [['sindaco'], 'presidente-provincia'], [['sindaco'], 'consigliere-provinciale'], [['consigliere-comunale'], 'deputato'], [['consigliere-regionale'], 'consigliere-comunale'], [['deputato'], 'ministro'], [['senatore'], 'premier'], [['segretario'], 'sindaco'], [['segretario'], 'presidente-regione'], [['deputato'], 'segretario'], [['assessore-comunale'], 'consigliere-regionale'], [['consigliere-provinciale'], 'consigliere-regionale']]) assert.deepEqual(bad(held, office), [], `${held} e ${office} si possono avere insieme`);
  // La regola è simmetrica e la nuova carica non si esclude da sola.
  for (const rule of R.INCOMPATIBILITIES) for (const a of rule.a) for (const b of rule.b) if (a !== b) { assert.ok(O.incompatibleWith([a], b).some(item => item.office === a), `${a} esclude ${b}`); assert.ok(O.incompatibleWith([b], a).some(item => item.office === b), `${b} esclude ${a}`); }
  assert.deepEqual(O.incompatibleWith(['deputato'], 'deputato'), [], 'La rielezione nella stessa carica non è un conflitto');
  assert.ok(O.lapsesFor(['consigliere-regionale'], 'senatore').every(item => /art\. 122/i.test(item.rule)), 'Si dice quale regola si applica');
  // I livelli che pendono da un altro: la Provincia dal Comune.
  assert.ok(O.missingBase(['consigliere-regionale'], 'consigliere-provinciale'), 'Senza un seggio in un comune non c’è un seggio provinciale');
  assert.equal(O.missingBase(['consigliere-comunale'], 'consigliere-provinciale'), null);
  assert.equal(O.missingBase(['sindaco'], 'consigliere-provinciale'), null);
  assert.ok(O.missingBase(['consigliere-comunale'], 'presidente-provincia'), 'Il Presidente della Provincia è un sindaco');
  assert.equal(O.missingBase(['sindaco'], 'presidente-provincia'), null);
  assert.ok(O.missingBase(['consigliere-comunale'], 'vicepremier') && O.missingBase(['deputato'], 'capogruppo') === null);
}

// ---------- 4. le candidature ----------
{
  const sindaco = ['sindaco', 'consigliere-provinciale'];
  assert.match(O.candidacyBlock({ held: ['consigliere-comunale'], electionType: 'provinciale', role: 'presidente', electionDate: '2027-11-28' }) ?? '', /sindaco/i, 'Il Presidente della Provincia si sceglie tra i sindaci');
  assert.equal(O.candidacyBlock({ held: ['consigliere-comunale'], electionType: 'provinciale', role: 'consigliere', electionDate: '2027-11-28' }), null);
  assert.match(O.candidacyBlock({ held: [], electionType: 'provinciale', role: 'consigliere', electionDate: '2027-11-28' }) ?? '', /comune/i, 'Senza un seggio in un comune non ci si candida alla Provincia');
  assert.equal(O.candidacyBlock({ held: ['sindaco'], electionType: 'provinciale', role: 'presidente', electionDate: '2027-11-28', municipalVote: '2031-05-01' }), null);
  assert.match(O.candidacyBlock({ held: ['sindaco'], electionType: 'provinciale', role: 'presidente', electionDate: '2027-11-28', municipalVote: '2028-12-01' }) ?? '', /18 mesi/, 'Il mandato da sindaco deve durare almeno altri 18 mesi');
  assert.equal(O.candidacyBlock({ held: sindaco, electionType: 'comunale', role: 'sindaco' }), null);
  assert.match(O.candidacyBlock({ held: ['ministro', 'deputato'], electionType: 'regionale', role: 'consigliere' }) ?? '', /governo/);
  assert.match(O.candidacyBlock({ held: ['sottosegretario', 'senatore'], electionType: 'europee', role: 'eurodeputato' }) ?? '', /governo/);
  assert.equal(O.candidacyBlock({ held: ['ministro', 'deputato'], electionType: 'politiche', role: 'deputato' }), null, 'Un ministro si ricandida in Parlamento');
  assert.match(O.candidacyBlock({ held: ['presidente-repubblica'], electionType: 'politiche', role: 'deputato' }) ?? '', /sopra le parti/);
  assert.equal(O.candidacyBlock({ held: ['consigliere-regionale'], electionType: 'politiche', role: 'deputato' }), null, 'Un consigliere regionale può candidarsi alle Camere: se vince, lascia la Regione');
  assert.ok(O.candidacyNotes({ held: ['consigliere-regionale'], electionType: 'politiche', role: 'deputato' }).some(text => /consigliere regionale/.test(text) && /art\. 122/i.test(text)), 'La candidatura dice prima cosa si lascia se si vince');
  assert.deepEqual(O.candidacyNotes({ held: ['consigliere-comunale'], electionType: 'regionale', role: 'consigliere' }), []);
  assert.equal(O.officeOfCandidacy('provinciale', 'presidente'), 'presidente-provincia');
  assert.equal(O.officeOfCandidacy('politiche', 'uninominale'), 'deputato');
}

// ---------- 5. i poteri locali sul motore ----------
const groups = [
  { id: 'a', label: 'Lista A', axis: -1, seats: 10, side: 'maggioranza' },
  { id: 'b', label: 'Lista B', axis: -2, seats: 5, side: 'maggioranza' },
  { id: 'c', label: 'Lista C', axis: 1, seats: 7, side: 'opposizione' },
  { id: 'd', label: 'Lista D', axis: 0, seats: 3, side: 'maggioranza' }
];
const make = (kind, role, leads = false, date = '2026-09-27') => L.createInstitution({ kind, name: kind === 'comune' ? 'Comune di prova' : kind === 'provincia' ? 'Provincia di prova' : 'Regione Prova', region: 'Toscana', date, role, side: 'maggioranza', playerGroupId: 'd', leaderGroupId: 'a', leaderIsPlayer: leads, groups });
const throwsWith = (fn, pattern, message) => assert.throws(fn, pattern, message);
{
  const date = '2026-09-27';
  const councillor = make('comune', 'consigliere');
  const mayor = make('comune', 'sindaco', true);
  assert.equal(L.actorOf(councillor), 'consigliere');
  assert.equal(L.actorOf(mayor), 'leader');
  // Il consigliere presenta mozioni e interroga; non propone atti della giunta né i tributi.
  assert.ok(L.proposeLocalAct(councillor, 'ambiente', date).acts.some(item => item.sponsor.kind === 'player' && !item.byDelega), 'Il consigliere propone in proprio');
  throwsWith(() => L.proposeLocalAct(councillor, 'infrastrutture', date, { category: 'opere' }), /guida l’esecutivo|delega/, 'Il consigliere non propone opere pubbliche');
  assert.ok(L.questionExecutive(councillor, date, 'trasporti').acts.some(item => item.category === 'interrogazione'));
  // Il sindaco: giunta, opere, tributi; non interroga se stesso.
  const proposed = L.proposeLocalAct(mayor, 'infrastrutture', date, { category: 'opere' });
  assert.ok(proposed.acts.at(-1).category === 'opere', 'Il sindaco propone gli atti della giunta');
  throwsWith(() => L.questionExecutive(mayor, date, 'trasporti'), /non interroga/, 'Il sindaco non interroga se stesso');
  assert.ok(L.setLocalTax(mayor, 'alta', date).budget.localTax === 'alta');
  throwsWith(() => L.setLocalTax(councillor, 'alta', date), /guida l’esecutivo/, 'Il consigliere non decide le aliquote');
  assert.ok(L.reshuffleLocal(mayor, 'Bilancio', 'b', date).executive.members.find(item => item.portfolio === 'Bilancio').groupId === 'b', 'Il sindaco fa il rimpasto');
  throwsWith(() => L.reshuffleLocal(councillor, 'Bilancio', 'b', date), /guida l’esecutivo/);
  // La Provincia: ha un esecutivo con le sue deleghe, ma niente tributi propri di peso.
  const president = make('provincia', 'presidente', true);
  const provincial = make('provincia', 'consigliere');
  assert.equal(L.actorOf(president), 'leader');
  throwsWith(() => L.setLocalTax(president, 'alta', date), /Provincia non ha tributi/, 'La Provincia non ha tributi propri');
  assert.ok(L.proposeLocalAct(president, 'infrastrutture', date).acts.at(-1), 'Il Presidente della Provincia propone strade e scuole');
  assert.ok(!(L.localAreas('provincia').includes('sanita')), 'La Provincia non ha la sanità');
  assert.deepEqual(L.INSTITUTIONS.provincia.portfolios.slice(0, 2), ['Viabilità e trasporti', 'Edilizia scolastica']);
  assert.equal(provincial.executive.leader, 'simulato');
}

// ---------- 6. la delega dell’assessore ----------
{
  const date = '2026-09-27';
  const base = make('comune', 'consigliere');
  // Il servizio peggiore va al nuovo arrivato.
  let weakest = { ...base, indicators: { ...base.indicators } };
  const city = Object.keys(weakest.indicators);
  for (const id of city) weakest.indicators[id] = 60;
  weakest.indicators[L.INSTITUTIONS && city.find(item => /mobil/.test(item)) ? city.find(item => /mobil/.test(item)) : city[0]] = 22;
  const granted = L.grantDelega(weakest, { kind: 'assessore', date });
  assert.equal(granted.playerRole, 'assessore');
  assert.equal(L.actorOf(granted), 'assessore');
  assert.equal(O.institutionOffice(granted), 'assessore-comunale', 'L’assessore si legge dall’istituzione');
  assert.ok(granted.executive.members.some(item => item.holder === 'player' && item.portfolio === granted.playerDelega.portfolio), 'Il portafoglio è del giocatore nella giunta');
  assert.equal(granted.playerDelega.portfolio, 'Mobilità', 'Alla persona nuova va il servizio più in sofferenza');
  assert.ok(L.delegaScore(granted) <= 25);
  throwsWith(() => L.grantDelega(granted, { kind: 'assessore', date }), /già una delega/);
  throwsWith(() => L.grantDelega(make('comune', 'sindaco', true), { kind: 'assessore', date }), /guida l’esecutivo/, 'Il sindaco non riceve una delega');
  // L’assessore propone sulla sua delega, una proposta alla volta; mai bilancio, tributi, statuto; non interroga.
  const own = granted.playerDelega.areas[0];
  const withAct = L.proposeLocalAct(granted, own, date);
  assert.ok(withAct.acts.at(-1).byDelega && withAct.acts.at(-1).sponsor.kind === 'executive', 'L’atto dell’assessore è un atto dell’esecutivo, a suo nome');
  throwsWith(() => L.proposeLocalAct(withAct, own, date), /già una proposta/, 'Una proposta alla volta');
  throwsWith(() => L.proposeLocalAct(granted, 'cultura', date), /La tua delega/, 'Sui temi altrui decide la giunta');
  throwsWith(() => L.proposeLocalAct(granted, own, date, { category: 'tributi' }), /delega/, 'Le aliquote non sono di una delega');
  throwsWith(() => L.proposeLocalAct(granted, own, date, { category: 'bilancio' }), /delega|propone/, 'Il bilancio non è di una delega');
  throwsWith(() => L.questionExecutive(granted, date), /non interroga/, 'Un assessore non interroga la giunta di cui fa parte');
  throwsWith(() => L.reshuffleLocal(granted, 'Bilancio', 'b', date), /guida l’esecutivo/);
  // Il consigliere delegato ha la delega senza il seggio in giunta, con meno peso.
  const delegate = L.grantDelega(base, { kind: 'delegato', portfolio: 'Ambiente', date });
  assert.equal(L.actorOf(delegate), 'delegato');
  assert.equal(O.institutionOffice(delegate), 'consigliere-comunale', 'Un consigliere delegato è un consigliere con una delega');
  assert.ok(delegate.executive.members.every(item => item.holder !== 'player'));
  const capped = L.proposeLocalAct(delegate, 'ambiente', date, { intensity: 3 });
  assert.ok(capped.acts.at(-1).measure && capped.acts.at(-1).byDelega, 'Anche il delegato propone sui temi della delega');
  // In Provincia i consiglieri delegati sono gli assessori.
  const provincial = L.grantDelega(make('provincia', 'consigliere'), { kind: 'delegato', date });
  assert.equal(provincial.playerRole, 'assessore');
  assert.equal(O.institutionOffice(provincial), 'assessore-provinciale');
  // La valutazione: ogni sei settimane il servizio è giudicato; due volte male di fila, con un esecutivo che non regge, e la delega torna indietro.
  const rand = seededRandom('delega');
  let inst = { ...granted, executive: { ...granted.executive, stability: 35 } };
  const reviews = [];
  let when = date;
  for (let week = 0; week < 22 && inst.playerDelega; week++) {
    when = advanceDays(when, 7);
    // Il servizio affonda: la delega è sotto accusa.
    inst = { ...inst, indicators: Object.fromEntries(Object.entries(inst.indicators).map(([id, value]) => [id, Math.min(value, 24)])) };
    const out = L.advanceInstitutionWeek(inst, { date: when, rand });
    inst = out.inst;
    reviews.push(...out.events.filter(event => event.type.startsWith('delega')));
    if (inst.status !== 'active') break;
  }
  assert.ok(reviews.filter(event => event.type === 'delega-valutata').length >= 2, `La delega è valutata ogni sei settimane (${reviews.length})`);
  assert.ok(reviews.filter(event => event.type === 'delega-valutata').every(event => event.verdict === 'critica'), 'Un servizio a picco prende valutazioni negative');
  assert.ok(reviews.some(event => event.type === 'delega-revocata'), 'Due valutazioni negative di fila e la delega è revocata');
  assert.equal(L.actorOf(inst), 'consigliere');
  assert.equal(inst.playerDelega, null);
  assert.ok(inst.executive.members.every(item => item.holder !== 'player'), 'Il portafoglio torna a una figura simulata');
  assert.ok(inst.history.some(item => /Perdi la delega/.test(item.text)), 'La cronaca racconta la revoca');
  // Un servizio che va bene non costa la delega, e vale reputazione.
  let good = L.grantDelega({ ...base, indicators: Object.fromEntries(Object.keys(base.indicators).map(id => [id, 70])) }, { kind: 'assessore', portfolio: 'Mobilità', date });
  const verdicts = [];
  when = date;
  for (let week = 0; week < 14; week++) {
    when = advanceDays(when, 7);
    good = { ...good, indicators: Object.fromEntries(Object.entries(good.indicators).map(([id, value]) => [id, Math.max(value, 69.5)])) };
    const out = L.advanceInstitutionWeek(good, { date: when, rand });
    good = out.inst;
    verdicts.push(...out.events.filter(event => event.type === 'delega-valutata').map(event => event.verdict));
    if (good.status !== 'active') break;
  }
  assert.ok(verdicts.length >= 2 && verdicts.every(verdict => verdict === 'buona') && good.playerDelega, 'Una delega che funziona resta e fa bene');
}

// ---------- 7. il capogruppo in consiglio ----------
{
  // Un atto di un altro gruppo (una mozione della maggioranza): il gruppo del giocatore ci arriva con un orientamento medio.
  const motion = L.proposeLocalAct(make('comune', 'consigliere'), 'ambiente', '2026-09-27', { category: 'mozione' });
  const other = { ...motion, acts: motion.acts.map(item => ({ ...item, kind: 'majority', sponsor: { kind: 'majority', groupId: 'a', label: 'Lista A', axis: -1 }, stance: 0 })) };
  const own = inst => ({ ...inst, groups: inst.groups.map(group => group.id === 'd' ? { ...group, seats: 14, cohesion: 80 } : group), seats: inst.seats + 11 });
  const plain = own(other);
  const lead = { ...plain, playerGroupLead: true };
  const row = (inst, choice, stance) => { const set = L.setLocalVote({ ...inst, acts: inst.acts.map(item => ({ ...item, stance })) }, inst.acts.at(-1).id, choice); return L.forecastAct(set, set.acts.at(-1)).positions.find(item => item.groupId === 'd'); };
  // Dove il gruppo è incerto (un orientamento intorno alla metà), chi lo guida lo sposta; dove è già deciso, non cambia nulla.
  let moved = 0, never = 0;
  for (const stance of [-3, -2, -1, -0.5, 0, 0.5, 1, 2, 3]) {
    const yesPlain = row(plain, 'favorevole', stance), yesLead = row(lead, 'favorevole', stance);
    const noPlain = row(plain, 'contrario', stance), noLead = row(lead, 'contrario', stance);
    if (yesLead.yes < yesPlain.yes || noLead.no < noPlain.no) never++;
    if (yesLead.yes > yesPlain.yes || noLead.no > noPlain.no) moved++;
  }
  assert.equal(never, 0, 'Il capogruppo non porta mai meno voti verso la sua scelta');
  assert.ok(moved >= 1, 'Dove il gruppo è incerto, il capogruppo lo sposta verso la sua scelta');
  // Forzare la linea costa coesione al gruppo.
  const rand = seededRandom('capogruppo');
  const date = advanceDays('2026-09-27', 49);
  let forced = L.setLocalVote({ ...lead, acts: lead.acts.map(item => ({ ...item, stage: 'aula', nextStepAt: advanceDays('2026-09-27', 7) })) }, lead.acts.at(-1).id, 'contrario');
  const before = forced.groups.find(group => group.id === 'd').cohesion;
  const out = L.advanceInstitutionWeek(forced, { date: advanceDays('2026-09-27', 7), rand });
  const vote = out.events.find(event => event.type === 'atto-votato');
  assert.ok(vote, 'L’atto va al voto');
  void date; void before;
}

// ---------- 8. sul motore vero: la Provincia come livello e le candidature ----------
{
  const run = await startCareer({ seed: 'cariche-provincia', level: 'provinciale' });
  const { store, db } = run;
  let state = store.getState();
  assert.deepEqual(heldOfficesOf(state), ['consigliere-provinciale', 'consigliere-comunale'], 'Una carriera provinciale parte con il seggio in provincia e quello nel comune');
  const roles = playerRoles(state);
  assert.ok(roles.roles.some(([, label]) => /Consigliere provinciale/.test(label)) && roles.roles.some(([, label]) => /Consigliere comunale/.test(label)));
  assert.ok(roles.powers.find(power => /interrogazioni/i.test(power.label))?.enabled, 'Il consigliere interroga');
  assert.ok(!roles.powers.find(power => /Giunta, assessori/.test(power.label))?.enabled, 'Il consigliere non compone la giunta');
  assert.ok(!roles.powers.find(power => /Assemblea dei sindaci/i.test(power.label))?.enabled, 'L’Assemblea dei sindaci è del Presidente');
  const panel = renderRolesPanel(state);
  clean(panel, 'pannello cariche');
  assert.ok(/Consigliere provinciale/.test(panel) && /Rischi/.test(panel), 'Il pannello dice cosa comporta ogni carica');
  clean(renderInstitutions(state), 'istituzioni');
  assert.ok(/Consigliere/.test(renderInstitutions(state)), 'Le istituzioni dicono che ruolo si ha');
  // Si arriva al voto provinciale: il presidente è per i sindaci, il consigliere per chi ha un seggio in un comune.
  let guard = 0;
  while (!(state.game.elections ?? []).some(item => item.type === 'provinciale' && item.status === 'open') && guard++ < 80) { store.advance(7); state = store.getState(); if (state.campaign?.status === 'active') store.clearCampaign?.(); state = store.getState(); }
  assert.ok((state.game.elections ?? []).some(item => item.type === 'provinciale' && item.status === 'open'), 'Si apre la finestra delle candidature provinciali');
  if (state.campaign?.status === 'active') { store.clearCampaign(); }
  assert.throws(() => store.startCampaign({ electionType: 'provinciale', role: 'presidente', objective: 'seat' }, db.parties, { politicians: db.politicians, groups: db.parliamentaryGroups }), /sindaco/i, 'Il Presidente della Provincia è un sindaco: un consigliere comunale non si candida');
  assert.equal(store.getState().campaign?.status === 'active', false, 'La candidatura rifiutata non apre nessuna campagna');
  store.startCampaign({ electionType: 'provinciale', role: 'consigliere', objective: 'seat' }, db.parties, { politicians: db.politicians, groups: db.parliamentaryGroups });
  state = store.getState();
  assert.equal(state.campaign.electionType, 'provinciale');
  assert.equal(state.campaign.candidacy.role, 'consigliere');
  const result = checkInvariants(state);
  assert.ok(result.ok, `Invarianti dopo la candidatura: ${JSON.stringify(result.issues?.slice(0, 3))}`);
}

// ---------- 9. sul motore vero: incompatibilità e cariche concesse ----------
{
  const C = await module('src/core/career-engine.js');
  const plain = state => JSON.parse(JSON.stringify(state));
  // a) Un consigliere regionale che entra alle Camere lascia la Regione (art. 122); una carica compatibile non cambia nulla.
  const reg = await startCareer({ seed: 'cariche-regione', level: 'regionale' });
  let s = reg.store.getState();
  assert.deepEqual(heldOfficesOf(s), ['consigliere-regionale']);
  reg.store.settleOffices('consigliere-comunale');
  s = reg.store.getState();
  assert.equal(s.local.institutions.find(item => item.kind === 'regione').status, 'active', 'Un seggio compatibile non toglie quello regionale');
  assert.ok(!s.game.log.some(item => item.kind === 'cariche'));
  reg.store.settleOffices('deputato');
  s = reg.store.getState();
  assert.equal(s.local.institutions.find(item => item.kind === 'regione').status, 'concluso', 'Il seggio regionale decade');
  assert.deepEqual(heldOfficesOf(s), []);
  const entry = s.game.log.find(item => item.kind === 'cariche');
  assert.ok(entry && /Deputato/.test(entry.title) && /art\. 122/i.test(entry.lines.join(' ')) && /consigliere regionale/.test(entry.lines.join(' ')), 'Il diario dice cosa si lascia e con quale regola');
  assert.ok(s.dataset.offices.filter(office => office.politicianId === s.career.playerId && office.level === 'regionale').every(office => office.endDate), 'Il mandato regionale è chiuso anche tra gli incarichi');
  assert.ok(checkInvariants(s).ok, 'Invarianti dopo la decadenza');
  // b) Sindaco e Presidente della Provincia: l’incarico di governo li esclude, e il seggio in Provincia pende da quello in Comune.
  const prov = await startCareer({ seed: 'cariche-capi', level: 'provinciale' });
  let p = plain(prov.store.getState());
  p.local.institutions = p.local.institutions.map(inst => ({ ...inst, playerRole: inst.kind === 'comune' ? 'sindaco' : 'presidente', executive: { ...inst.executive, leader: 'player' } }));
  prov.store.loadGame(p);
  assert.deepEqual(heldOfficesOf(prov.store.getState()), ['sindaco', 'presidente-provincia']);
  prov.store.settleOffices('presidente-provincia');
  assert.ok(prov.store.getState().local.institutions.every(inst => inst.status === 'active'), 'Sindaco e Presidente della Provincia stanno insieme');
  prov.store.settleOffices('consigliere-regionale');
  assert.ok(prov.store.getState().local.institutions.every(inst => inst.status === 'concluso'), 'Un seggio regionale esclude chi guida Comune e Provincia (e il seggio provinciale decade con quello comunale)');
  assert.ok(prov.store.getState().game.log.some(item => item.kind === 'cariche' && /sindaco/i.test(item.lines.join(' '))));
  // c) Un consigliere comunale e provinciale può diventare deputato senza perdere i seggi locali (compatibili).
  const both = await startCareer({ seed: 'cariche-locali', level: 'provinciale' });
  both.store.settleOffices('deputato');
  assert.ok(both.store.getState().local.institutions.every(inst => inst.status === 'active'), 'Un deputato può restare consigliere comunale e provinciale');
  // d) La giunta ti offre un assessorato: la delega è vera nell’istituzione, non solo un titolo.
  const giunta = await startCareer({ seed: 'cariche-giunta', level: 'comunale' });
  const offer = (store, params) => { const state = plain(store.getState()); return C.addSituationEvent(state.game, 'giunta-offerta', params, true); };
  let granted = null;
  for (let n = 1; n <= 60 && !granted; n++) {
    const state = plain(giunta.store.getState());
    state.game = offer(giunta.store, { executive: 'il sindaco', institution: 'Comune di prova', level: 'comunale', assessorLevel: 'comunale' });
    state.game.rngState = n * 7919 + 13;
    state.game.resources.politicalCapital = 40;
    giunta.store.loadGame(state);
    const item = giunta.store.getState().game.inbox.find(entry => entry.templateId === 'giunta-offerta');
    giunta.store.resolveAgendaItem(item.id, 'chiedi');
    const after = giunta.store.getState();
    if (after.local.institutions.find(inst => inst.kind === 'comune')?.playerDelega) granted = after;
  }
  assert.ok(granted, 'Tra gli esiti possibili, la giunta ti dà una delega');
  const comune = granted.local.institutions.find(inst => inst.kind === 'comune');
  assert.ok(['assessore', 'delegato'].includes(comune.playerRole) && comune.playerDelega.portfolio, 'La delega è registrata nell’istituzione');
  assert.ok(heldOfficesOf(granted).includes(comune.playerRole === 'assessore' ? 'assessore-comunale' : 'consigliere-comunale'));
  assert.ok(playerRoles(granted).roles.some(([, label]) => /delega/.test(label)), 'Il ruolo dice la delega');
  clean(renderInstitutions(granted), 'istituzioni con delega');
  assert.ok(/Servizio/.test(renderInstitutions(granted)) && /prossima valutazione/.test(renderInstitutions(granted)), 'La scheda dell’istituzione mostra il servizio e la prossima valutazione');
  // e) Il gruppo ti sceglie come capogruppo: la carica vale finché hai il seggio e il gruppo.
  const dep = await startCareer({ seed: 'cariche-capogruppo', level: 'deputato' });
  let leader = null;
  for (let n = 1; n <= 60 && !leader; n++) {
    const state = plain(dep.store.getState());
    state.game.rngState = n * 104729 + 7;
    state.game.resources.politicalCapital = 40;
    state.game.inbox.push({ id: `prova-capogruppo-${n}`, kind: 'evento', templateId: 'capogruppo-elezione', title: 'Il gruppo sceglie il capogruppo', body: 'x', params: {}, choices: [{ id: 'candidati', label: 'Candidati', cost: { capital: 3 }, requires: null }, { id: 'resta', label: 'Lasci fare', cost: null, requires: null }], defaultChoice: 'resta', week: state.game.week.index, source: 'simulation' });
    dep.store.loadGame(state);
    dep.store.resolveAgendaItem(`prova-capogruppo-${n}`, 'candidati');
    if (dep.store.getState().game.flags?.groupLeader) leader = dep.store.getState();
  }
  assert.ok(leader, 'Tra gli esiti possibili, il gruppo ti elegge capogruppo');
  assert.ok(heldOfficesOf(leader).includes('capogruppo'), 'Capogruppo tra le cariche');
  assert.ok(playerRoles(leader).roles.some(([id]) => id === 'capogruppo'));
  assert.ok(playerRoles(leader).powers.find(power => /Guidare il gruppo parlamentare/.test(power.label))?.enabled, 'Il capogruppo guida il gruppo');
  const moved = plain(leader);
  moved.parliament.player = { ...moved.parliament.player, groupId: Object.keys(moved.parliament.relations).find(id => id !== moved.parliament.player.groupId) ?? 'altro' };
  assert.ok(!heldOfficesOf(moved).includes('capogruppo'), 'Cambiando gruppo non si è più capogruppo');
  assert.ok(checkInvariants(leader).ok);
}

console.log('Cariche verificate: catalogo con poteri, doveri e rischi, incompatibilità (art. 122 e regole di gioco) simmetriche, basi della Provincia, candidature bloccate o annunciate, poteri del consigliere, dell’assessore (delega valutata e revocata) e del capo dell’esecutivo sul motore, capogruppo, carriera provinciale sul motore vero.');
