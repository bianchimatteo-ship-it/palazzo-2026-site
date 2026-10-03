// Territorial committees and the logo editor. Committees: Region → Province → Comune on the ISTAT map, states from
// foundation to dissolution, player actions with costs, a crisis decision, and real effects on campaigns (volunteers,
// organisation, candidacy, local support), results and promotions. Logo editor: crop frame (free/square ratio, zoom
// and pan, transparent margins), background knock-out, dominant colour, metadata kept with the logo.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = globalThis.localStorage;
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const read = async name => JSON.parse(await readFile(new URL(`../src/data/real/${name}.json`, import.meta.url), 'utf8'));
const units = await read('territorial-units');
const groups = await read('parliamentary-groups');
const parties = await read('parties');
const unitsSnapshot = JSON.stringify(units);
const committeesEngine = await import(`../src/core/committee-engine.js${v}`);
const logo = await import(`../src/core/logo-editor.js${v}`);
const { panFromDrag } = await import(`../src/ui/logo-editor-view.js${v}`);
const { store } = await import(`../src/core/store.js${v}`);
const { renderPartyPage } = await import(`../src/ui/party-page.js${v}`);
const { progressionFactors } = await import(`../src/core/progression-engine.js${v}`);
const { saveLocalLogo, getLocalLogo } = await import(`../src/data/repositories/logo-store.js${v}`);
const clean = html => { const text = html.replace(/data-[a-z-]+="[^"]*"/g, ''); const match = text.match(/undefined|NaN|\[object Object\]|Infinity/); if (match) console.error(`…${text.slice(Math.max(0, match.index - 120), match.index + 30)}…`); return !match; };
const seeded = seed => { let state = seed >>> 0 || 1; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; };
const { COMMITTEE_STATES, committeeStrength, createCommittees, advanceCommittees, applyCommitteeAction, foundCommittee, committeeSupport, committeesAfterVote, committeeSummary } = committeesEngine;

// ---------- 1. committees on the ISTAT map ----------
const org = { sections: [{ region: 'Toscana', members: 2400, vitality: 58 }, { region: 'Lazio', members: 3100, vitality: 44 }], priorities: { territorio: 1 }, cohesion: 58, treasury: { balance: 5000 }, growth: 0.2 };
const currents = [{ id: 'riformisti', label: 'Area riformista', value: 55, strength: 40 }, { id: 'territori', label: 'Area dei territori', value: 48, strength: 34 }];
const home = { region: 'Toscana', municipality: 'Siena', provinceCode: null, provinceName: null };
org.committees = createCommittees(org, { region: 'Toscana', units, home, currents, rank: 1, founder: false, week: 1, rand: seeded(7) });
const toscana = units.filter(unit => unit.gameRegion === 'Toscana');
assert.equal(org.committees.filter(item => item.level === 'regione').length, 2, 'Un comitato regionale per ogni federazione.');
assert.equal(org.committees.filter(item => item.level === 'provincia').length, toscana.length, `Un comitato per ogni provincia toscana (${toscana.length}).`);
const siena = org.committees.find(item => item.level === 'comune');
assert.ok(siena && siena.name === 'Siena' && siena.unitCode === toscana.find(unit => unit.name === 'Siena').code, 'Il comune del giocatore è collegato alla sua provincia ISTAT (anche per carriere senza codice).');
assert.ok(siena.leader.player, 'Da coordinatore locale guidi il comitato del tuo comune.');
assert.ok(org.committees.every(item => item.source === 'simulation' && COMMITTEE_STATES[item.status] && committeeStrength(item) >= 0 && committeeStrength(item) <= 100), 'Comitati simulati con stato e forza validi.');
assert.ok(org.committees.filter(item => item.level !== 'comune' && !item.leader.player).every(item => /figura simulata/.test(item.leader.label)), 'I responsabili sono figure simulate, mai persone reali.');
assert.equal(JSON.stringify(units), unitsSnapshot, 'I dati ISTAT non cambiano.');

// ---------- 2. a year of territorial life, and every state reachable ----------
const seen = new Set(org.committees.map(item => item.status));
const random = seeded(11);
for (let week = 2; week <= 60; week++) advanceCommittees(org, { rand: random, week, regionalShares: { Toscana: 14, Lazio: 9 }, nationalShare: 11, currents });
for (const item of org.committees) seen.add(item.status);
assert.ok(org.committees.every(item => item.organization >= 0 && item.organization <= 100 && item.loyalty >= 0 && item.loyalty <= 100 && item.members >= 0), 'Valori sempre nei limiti.');
assert.ok(org.committees.find(item => item.level === 'regione' && item.region === 'Toscana').consensus > 50, 'Dove il partito va meglio della media il consenso locale è sopra 50.');
// A neglected committee in the hands of a hostile area: crisis, then loss of control, then dissolution.
const pisa = org.committees.find(item => item.level === 'provincia' && item.name === 'Pisa');
Object.assign(pisa, { organization: 28, loyalty: 30, status: 'crescita', statusSince: 0, leader: { label: 'Coordinamento provinciale (figura simulata)', currentId: 'territori', player: false } });
currents[1].value = 10;
const path = [];
for (let week = 61; week <= 200 && pisa.status !== 'dissoluzione'; week++) {
  pisa.organization = Math.max(0, pisa.organization - 2);
  advanceCommittees(org, { rand: random, week, currents });
  if (path.at(-1) !== pisa.status) path.push(pisa.status);
}
for (const status of path) seen.add(status);
assert.ok(path.includes('crisi') && path.includes('perdita-controllo') && path.at(-1) === 'dissoluzione', `Un comitato abbandonato passa da crisi e perdita del controllo alla dissoluzione (${path.join(' → ')}).`);
assert.equal(pisa.members, 0, 'Un comitato sciolto non ha più iscritti.');
// Foundation and growth: a new committee starts in foundation and grows with work.
const lucca = org.committees.find(item => item.name === 'Lucca');
if (lucca) lucca.status = 'dissoluzione';
const refounded = foundCommittee(org, { level: 'provincia', name: 'Lucca', region: 'Toscana', week: 201, currents, rand: random, extra: { unitCode: toscana.find(unit => unit.name === 'Lucca').code } });
assert.equal(refounded.status, 'fondazione', 'Un comitato rifondato riparte dalla fondazione.');
seen.add(refounded.status);
for (let week = 202; week <= 240; week++) { if (week % 3 === 0) applyCommitteeAction(org, refounded, 'rilancia', { week, rand: random, currents }); advanceCommittees(org, { rand: random, week, currents }); }
seen.add(refounded.status);
assert.ok(['crescita', 'consolidamento'].includes(refounded.status), `Con visite regolari il comitato cresce (${refounded.status}).`);
for (const status of Object.keys(COMMITTEE_STATES)) assert.ok(seen.has(status), `Stato raggiunto: ${status}.`);
assert.throws(() => applyCommitteeAction(org, pisa, 'rilancia', { week: 241 }), /sciolto/, 'Un comitato sciolto non si rilancia: si rifonda.');
assert.throws(() => applyCommitteeAction(org, refounded, 'commissaria', { week: 241, leader: false }), /guida il partito/, 'Solo chi guida il partito commissaria.');

// ---------- 3. effects: campaign support, the vote, promotions ----------
const strong = committeeSupport(org, { electionType: 'comunale', region: 'Toscana', municipality: 'Siena' });
assert.ok(strong.committees.length >= 2 && strong.volunteers >= 0 && Math.abs(strong.localSupport) <= 1.5 && Math.abs(strong.nomination) <= 0.6, 'Alle comunali contano il comitato comunale e quello provinciale.');
const regional = committeeSupport(org, { electionType: 'regionale', region: 'Toscana' });
assert.ok(regional.committees.some(item => item.level === 'regione') && regional.committees.some(item => item.level === 'provincia'), 'Alle regionali contano la regione e le province.');
const siena0 = siena.organization;
const lines = committeesAfterVote(org, { mandate: true, electionType: 'comunale', region: 'Toscana', municipality: 'Siena', week: 250 });
assert.ok(lines.length && siena.organization >= siena0, 'Una vittoria rafforza i comitati del territorio.');
const lost = { ...org, committees: org.committees.map(item => item.level === 'comune' ? { ...item, status: 'perdita-controllo', loyalty: 10 } : item) };
assert.ok(committeeSupport(lost, { electionType: 'comunale', region: 'Toscana', municipality: 'Siena' }).nomination < 0, 'Un comitato fuori controllo pesa contro la candidatura.');
assert.ok(committeeSummary(org).total === org.committees.length, 'Riepilogo della rete.');

// ---------- 3b. structures: seats with a cost, volunteers, recruiting, fundraising, autonomy, crises, local events ----------
{
  const { ensureStructure, committeeProfile, committeeActionCost, applyLocalEvent, SEAT_TIERS, PARTY_SCALES, scaleOf } = committeesEngine;
  const make = () => {
    const base = { sections: [{ region: 'Toscana', members: 2400, vitality: 58 }, { region: 'Lazio', members: 3100, vitality: 44 }], priorities: { territorio: 1, formazione: 1 }, cohesion: 58, treasury: { balance: 20000, current: { income: 0, expense: 0, byCategory: {} }, yearTotals: { income: 0, expense: 0, byCategory: {} } }, growth: 0.2, conflicts: [] };
    base.committees = createCommittees(base, { region: 'Toscana', units, home: { region: 'Toscana', municipality: 'Siena' }, currents, rank: 1, founder: false, week: 1, rand: seeded(7) });
    return base;
  };
  // Older committees (without the new fields) are given them when met again, and keep working.
  const legacy = make();
  for (const item of legacy.committees) for (const key of ['quality', 'fatigue', 'activity', 'autonomy', 'seat', 'raised', 'membersLog', 'trend', 'autonomyBias']) delete item[key];
  assert.doesNotThrow(() => { for (let week = 2; week <= 12; week++) advanceCommittees(legacy, { rand: seeded(week), week, regionalShares: { Toscana: 12 }, nationalShare: 10, currents }); }, 'Un vecchio comitato continua a funzionare');
  assert.ok(legacy.committees.every(item => Number.isFinite(item.quality) && Number.isFinite(item.activity) && Number.isFinite(item.autonomy) && item.seat >= 0 && item.seat < SEAT_TIERS.length), 'E riceve qualità, attività, autonomia e sede.');

  // Seats cost every week (the regional ones are the federations' own); the local fundraising comes back.
  const economy = make();
  const province = economy.committees.find(item => item.level === 'provincia');
  Object.assign(province, { seat: 2, activity: 55, quality: 60 });
  const regional = economy.committees.find(item => item.level === 'regione');
  regional.seat = 3;
  const before = economy.treasury.balance;
  advanceCommittees(economy, { rand: seeded(3), week: 2, regionalShares: {}, nationalShare: 10, currents });
  const byCategory = economy.treasury.current.byCategory;
  const expected = Math.round(SEAT_TIERS[2].upkeep * 1.6 * PARTY_SCALES.nazionale.upkeep) + economy.committees.filter(item => item.level !== 'regione' && item !== province && item.seat > 0).reduce((sum, item) => sum + Math.round(SEAT_TIERS[item.seat].upkeep * ({ provincia: 1.6, comune: 1 }[item.level]) * PARTY_SCALES.nazionale.upkeep), 0);
  assert.equal(-byCategory.sedi, expected, `Le sedi dei comitati locali costano ogni settimana (${-byCategory.sedi} su ${expected}); quelle regionali sono già nelle sezioni.`);
  assert.ok(byCategory.donazioni > 0 && economy.territory.raised === byCategory.donazioni && province.raised > 0, 'La raccolta fondi locale arriva alla tesoreria del partito.');
  assert.equal(economy.treasury.balance, before - expected + byCategory.donazioni, 'Tesoreria coerente: costi delle sedi e raccolta.');
  // An autonomous committee keeps part of what it raises.
  const keeper = make(), obedient = make();
  for (const [o, autonomy] of [[keeper, 90], [obedient, 10]]) for (const item of o.committees) Object.assign(item, { autonomy, autonomyBias: autonomy > 50 ? 40 : -40, loyalty: 60 });
  advanceCommittees(keeper, { rand: seeded(5), week: 2, nationalShare: 10, currents }); advanceCommittees(obedient, { rand: seeded(5), week: 2, nationalShare: 10, currents });
  assert.ok(keeper.territory.raised < obedient.territory.raised, `Un comitato autonomo trattiene una parte della raccolta (${keeper.territory.raised} contro ${obedient.territory.raised}).`);

  // Growth is not automatic: recruiting follows activity and work; a neglected committee loses people.
  const worked = make(), neglected = make();
  const pick = o => o.committees.find(item => item.level === 'provincia' && item.name === 'Pisa');
  for (const [o, seat] of [[worked, 2], [neglected, 0]]) Object.assign(pick(o), { seat, members: 300, activists: 24, organization: 50, activity: 40, loyalty: 60 });
  const r1 = seeded(21), r2 = seeded(21);
  applyCommitteeAction(worked, pick(worked), 'recluta', { week: 2, rand: r1, currents, scale: 'regionale' });
  for (let week = 3; week <= 30; week++) {
    if (week % 4 === 0) applyCommitteeAction(worked, pick(worked), 'iniziativa', { week, rand: r1, currents });
    advanceCommittees(worked, { rand: r1, week, regionalShares: { Toscana: 12 }, nationalShare: 10, currents });
    advanceCommittees(neglected, { rand: r2, week, regionalShares: { Toscana: 12 }, nationalShare: 10, currents });
  }
  assert.ok(pick(worked).members > pick(neglected).members && pick(worked).activity > pick(neglected).activity, `Il comitato curato cresce più di quello trascurato (${pick(worked).members} contro ${pick(neglected).members} iscritti).`);
  assert.ok(pick(neglected).activity < 40 && pick(neglected).trend <= 0.5, 'Senza attività i volontari si spengono e la crescita si ferma.');
  assert.ok(['crescita', 'stabile', 'declino'].includes(committeeProfile(pick(worked)).trend) && ['forte', 'solido', 'debole', 'fragile'].includes(committeeProfile(pick(worked)).tier), 'Ogni comitato ha una forza e una tendenza.');

  // Volunteers: quality is built with training and wears out with fatigue.
  const crew = make();
  const unit = pick(crew);
  Object.assign(unit, { quality: 40, fatigue: 50, activity: 50 });
  applyCommitteeAction(crew, unit, 'forma', { week: 2, rand: seeded(2), currents });
  assert.ok(unit.quality === 50 && unit.fatigue === 40, 'La formazione alza la qualità e riduce la stanchezza.');
  assert.throws(() => applyCommitteeAction(crew, unit, 'forma', { week: 3, rand: seeded(2), currents }), /da poco/, 'Non si forma di continuo.');
  applyCommitteeAction(crew, unit, 'mobilita', { week: 3, rand: seeded(2), currents });
  for (let week = 4; week <= 10; week++) advanceCommittees(crew, { rand: seeded(week), week, currents, campaignActive: true });
  assert.ok(unit.fatigue > 40, 'Mobilitare stanca i volontari.');

  // Autonomy: a local party leaves its committees more room than a national one; the leader can grant it or take it back.
  assert.deepEqual([scaleOf({ nationalShare: 0.8 }), scaleOf({ nationalShare: 3 }), scaleOf({ nationalShare: 14 }), scaleOf({ nationalShare: 14, founder: true })], ['locale', 'regionale', 'nazionale', 'locale'], 'La scala del partito segue i sondaggi (o la fondazione).');
  const local = make(), national = make();
  for (let week = 2; week <= 60; week++) { advanceCommittees(local, { rand: seeded(week), week, nationalShare: 0.8, currents }); advanceCommittees(national, { rand: seeded(week), week, nationalShare: 14, currents }); }
  assert.ok(pick(local).autonomy > pick(national).autonomy + 10, `Un partito locale lascia più autonomia (${pick(local).autonomy} contro ${pick(national).autonomy}).`);
  const granted = pick(national).autonomy;
  applyCommitteeAction(national, pick(national), 'delega', { week: 61, rand: seeded(1), currents, leader: true });
  assert.ok(pick(national).autonomy > granted && pick(national).loyalty > 0, 'Concedere autonomia la fa salire.');
  assert.throws(() => applyCommitteeAction(national, pick(national), 'delega', { week: 62, rand: seeded(1), currents, leader: false }), /guida il partito/, 'Solo chi guida il partito concede autonomia.');
  const tamed = pick(national).autonomy;
  Object.assign(pick(national), { status: 'crisi', statusSince: 0 });
  applyCommitteeAction(national, pick(national), 'commissaria', { week: 63, rand: seeded(1), currents, leader: true });
  assert.ok(pick(national).autonomy < tamed, 'Il commissario riporta il comitato sotto controllo.');

  // A crisis costs people; without money the seats close and the activity falls.
  const trouble = make();
  const hit = pick(trouble);
  Object.assign(hit, { organization: 33, status: 'crescita', statusSince: -10, members: 400, activists: 40, seat: 2 });
  let peopleBefore = hit.members + hit.activists;
  for (let week = 2; week < 60 && hit.status === 'crescita'; week++) { hit.organization = Math.max(0, hit.organization - 4); peopleBefore = hit.members + hit.activists; advanceCommittees(trouble, { rand: seeded(week), week, currents }); }
  assert.ok(['crisi', 'perdita-controllo'].includes(hit.status) && hit.members + hit.activists < peopleBefore, `Entrare in crisi fa perdere iscritti e volontari (${peopleBefore} → ${hit.members + hit.activists}).`);
  const poor = make();
  poor.treasury.balance = -500;
  for (const item of poor.committees.filter(item => item.level !== 'regione')) item.seat = 3;
  for (let week = 2; week <= 60; week++) advanceCommittees(poor, { rand: seeded(100 + week), week, currents });
  assert.ok(poor.committees.filter(item => item.level !== 'regione').some(item => item.seat < 3), 'In crisi finanziaria i comitati perdono le sedi.');

  // Money and elections: the strong committees bring volunteers, mobilisation and money to the campaign.
  const campaignOrg = make();
  for (const item of campaignOrg.committees) Object.assign(item, { activists: 40, quality: 70, activity: 70, raised: 5000, autonomy: 40, status: 'consolidamento' });
  const calm = committeeSupport(campaignOrg, { electionType: 'comunale', region: 'Toscana', municipality: 'Siena', week: 10 });
  for (const item of campaignOrg.committees) item.mobilizedUntil = 20;
  const mobilised = committeeSupport(campaignOrg, { electionType: 'comunale', region: 'Toscana', municipality: 'Siena', week: 10 });
  assert.ok(calm.funds > 0 && calm.gotv > 0 && mobilised.gotv > calm.gotv, `Volontari di qualità e mobilitati portano più voti (${calm.gotv} → ${mobilised.gotv}) e ${calm.funds} € alla campagna.`);
  const loose = make();
  for (const item of loose.committees) Object.assign(item, { autonomy: 90, status: 'consolidamento', loyalty: 80, leader: { ...item.leader, player: false } });
  assert.ok(committeeSupport(loose, { electionType: 'comunale', region: 'Toscana', municipality: 'Siena' }).nomination < 0.6, 'Comitati che decidono da soli pesano meno sulla tua candidatura.');

  // The seat price grows with the level and the tier; the local events leave their mark.
  const sede = pick(make());
  sede.seat = 0;
  const first = committeeActionCost(sede, 'sede').funds;
  sede.seat = 1;
  assert.ok(committeeActionCost(sede, 'sede').funds > first && committeeActionCost({ ...sede, level: 'regione' }, 'sede').funds > committeeActionCost(sede, 'sede').funds, 'La sede migliore costa di più a ogni passo e ai livelli alti.');
  const eventOrg = make();
  const lucky = pick(eventOrg);
  Object.assign(lucky, { activity: 50, consensus: 55, quality: 60, organization: 55, fatigue: 5 });
  const seen = new Set();
  const luck = seeded(77);
  for (let week = 2; week <= 400 && seen.size < 3; week++) { const out = advanceCommittees(eventOrg, { rand: luck, week, nationalShare: 10, currents, homeRegion: 'Toscana' }); for (const event of out.events.filter(item => item.type === 'local')) seen.add(event.kind); }
  assert.deepEqual([...seen].sort(), ['concorrenza', 'opportunita', 'scandalo'], 'Nel territorio di casa capitano opportunità, scandali locali e concorrenza.');
  const before2 = { members: lucky.members, activity: lucky.activity };
  assert.ok(applyLocalEvent(eventOrg, lucky, 'opportunita', 'delega', { week: 1, rand: seeded(1) }).length && lucky.activity > before2.activity, 'Lasciare fare al responsabile locale dà attività e autonomia.');
  const scandal = pick(make());
  const consensus = scandal.consensus;
  applyLocalEvent({}, scandal, 'scandalo', 'ignora', { week: 1, rand: seeded(1) });
  assert.ok(scandal.consensus < consensus && scandal.members < 300 + 1000, 'Ignorare uno scandalo locale costa consenso e iscritti.');
  const rival = pick(make());
  const volunteers = rival.activists;
  applyLocalEvent({}, rival, 'concorrenza', 'subisci', { week: 1, rand: seeded(1) });
  assert.ok(rival.activists < volunteers, 'Subire la concorrenza costa i volontari migliori.');
}

// ---------- 4. the career: actions with costs, a crisis decision, campaign and weekly life ----------
const volt = parties.find(item => item.id === 'party-registro-p1-2024-71-ir');
store.createCareer({ firstName: 'Marta', lastName: 'Neri', birthDate: '1985-02-11', gender: 'donna', region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', provinceCode: '052', provinceName: 'Siena', provinceType: 'Provincia', previousProfession: 'Architetta', initialLevel: 'comunale', partyMode: 'existing', partyId: volt.id, parliamentStartMode: 'real-context', parliamentaryGroupId: '', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } }, [volt], groups);
assert.ok(store.initializeCommittees(units), 'I comitati nascono quando i territori ISTAT sono disponibili.');
assert.equal(store.initializeCommittees(units), false, '…una volta sola.');
let state = store.getState();
const mine = state.game.party.org.committees.find(item => item.level === 'comune');
assert.ok(mine && mine.unitCode === '052', 'Comitato del comune del giocatore nella sua provincia.');
const before = { ap: state.game.week.ap, funds: state.game.resources.funds };
store.committeeAction('rilancia', { committeeId: mine.id });
store.committeeAction('finanzia', { committeeId: mine.id });
state = store.getState();
assert.equal(state.game.week.ap, before.ap - 1, 'La visita costa un giorno.');
assert.equal(state.game.resources.funds, before.funds - 800, 'Finanziare costa 800 €.');
assert.ok(state.game.party.org.committees.find(item => item.id === mine.id).fundedUntil > state.game.week.index, 'Il finanziamento dura alcune settimane.');
assert.ok(state.game.log.some(item => /Visita e rilancia/.test(item.title)), 'L’azione entra nel diario.');
assert.throws(() => store.committeeAction('commissaria', { committeeId: mine.id }), /guida il partito/, 'Un iscritto non commissaria.');
const unit = units.find(item => item.gameRegion === 'Umbria');
store.getState().game.week.ap = 0;
assert.throws(() => store.committeeAction('fonda', { level: 'provincia', name: unit.name, region: 'Umbria', unitCode: unit.code }), /giorni/, 'Senza giorni non si fonda nulla.');
store.getState().game.week.ap = 6; store.getState().game.resources.funds = 5000;
store.committeeAction('fonda', { level: 'provincia', name: unit.name, region: 'Umbria', unitCode: unit.code, unitType: unit.type });
assert.ok(store.getState().game.party.org.committees.some(item => item.name === unit.name && item.status === 'fondazione'), 'Un nuovo comitato provinciale nasce in fondazione.');
// A crisis in the player's own territory becomes a decision in the agenda.
const game = store.getState().game;
const homeProvince = game.party.org.committees.find(item => item.level === 'provincia' && item.unitCode === '052');
Object.assign(homeProvince, { organization: 20, status: 'crescita', statusSince: -10, lastVisitWeek: null, fundedUntil: null });
for (let index = 0; index < 4 && !store.getState().game.inbox.some(item => item.templateId === 'comitato-in-crisi'); index++) { const current = store.getState().game.party.org.committees.find(item => item.id === homeProvince.id); if (current.status === 'crescita') Object.assign(current, { organization: 12, statusSince: -10 }); store.advance(7); }
const crisis = store.getState().game.inbox.find(item => item.templateId === 'comitato-in-crisi');
assert.ok(crisis && crisis.choices.some(choice => choice.id === 'intervieni') && crisis.choices.some(choice => choice.id === 'commissaria'), 'Un comitato di casa in crisi apre una decisione in agenda.');
store.getState().game.week.ap = 6; store.getState().game.resources.politicalCapital = 20;
store.resolveAgendaItem(crisis.id, 'intervieni');
assert.ok(store.getState().game.party.org.committees.find(item => item.id === homeProvince.id).organization > 12, 'Intervenire rimette in piedi il comitato.');
// The new actions through the career: recruiting, a better seat, a fundraising dinner; autonomy is for whoever leads the party.
{
  const G = () => store.getState().game;
  const find = id => G().party.org.committees.find(item => item.id === id);
  G().week.ap = 6; G().resources.funds = 8000; G().resources.politicalCapital = 20;
  const id = G().party.org.committees.find(item => item.level === 'comune').id;
  const { committeeActionCost } = committeesEngine;
  const members0 = find(id).members, funds0 = G().resources.funds, ap0 = G().week.ap;
  store.committeeAction('recluta', { committeeId: id });
  assert.ok(find(id).members > members0 && G().resources.funds === funds0 - 350 && G().week.ap === ap0 - 1 && find(id).recruitUntil > G().week.index, 'La campagna di tesseramento porta iscritti e costa giorni e soldi.');
  assert.throws(() => store.committeeAction('recluta', { committeeId: id }), /già in corso/, 'Non si apre due volte.');
  const seat0 = find(id).seat, price = committeeActionCost(find(id), 'sede').funds, money = G().resources.funds;
  store.committeeAction('sede', { committeeId: id });
  assert.ok(find(id).seat === seat0 + 1 && G().resources.funds === money - price, `Una sede migliore costa ${price} € e dà capacità di lavoro.`);
  const treasury0 = G().party.org.treasury.balance;
  store.committeeAction('raccolta', { committeeId: id });
  assert.ok(G().party.org.treasury.balance > treasury0 && find(id).raised > 0, 'La cena di raccolta fondi porta soldi alla tesoreria del partito.');
  assert.throws(() => store.committeeAction('raccolta', { committeeId: id }), /da poco/, 'Né si ripete subito.');
  assert.throws(() => store.committeeAction('delega', { committeeId: id }), /guida il partito/, 'Concedere autonomia spetta a chi guida il partito.');
  // A local event of the territory is a decision with consequences on the committee.
  const { addSituationEvent } = await import(`../src/core/career-engine.js${v}`);
  const target = (G().party.org.committees.find(item => item.level === 'provincia' && item.unitCode === '052') ?? find(id)).id;
  for (const [kind, choice, check] of [['opportunita', 'delega', item => item.activity > 20], ['scandalo', 'ignora', item => item.consensus < 90], ['concorrenza', 'rilancia', item => item.recruitUntil > 0]]) {
    store.getState().game = addSituationEvent(G(), `comitato-locale-${kind}`, { committee: find(target).name, committeeId: target, committeeLevel: 'comitato provinciale', dedupe: `prova-${kind}` }, true);
    const open = G().inbox.find(entry => entry.templateId === `comitato-locale-${kind}` && entry.params.dedupe === `prova-${kind}`);
    assert.ok(open && open.choices.length === 3, `Evento locale: ${kind}.`);
    G().week.ap = 6; G().resources.funds = 8000; G().resources.politicalCapital = 20;
    store.resolveAgendaItem(open.id, choice);
    assert.ok(check(find(target)) && G().log.some(entry => entry.lines?.some(line => line.includes(find(target).name))), `La scelta su «${kind}» lascia il suo segno sul comitato.`);
  }
}
// Promotions: the territory factor reads the committees of the player's territory.
const factors = progressionFactors({ game: store.getState().game, stats: { popularity: 50 } });
assert.ok(Number.isFinite(factors.territory) && factors.territory > 0, 'Le promozioni leggono il radicamento dei comitati.');
// The Partito section, Territorio tab.
state = store.getState();
const html = renderPartyPage(state, { tab: 'territorio', record: volt, logoFor: () => null, territory: { units, home: store.homePlace(), filter: 'tutti' } });
assert.ok(html.includes('cm-panel') && html.includes('IL TUO TERRITORIO') && html.includes('Siena') && html.includes('data-committee-action="rilancia"') && clean(html), 'Scheda Territorio del Partito.');
for (const filter of ['attivi', 'problemi', 'sciolti']) assert.ok(clean(renderPartyPage(state, { tab: 'territorio', record: volt, territory: { units, home: store.homePlace(), filter } })), `Filtro ${filter}.`);
// The campaign starts with the committees of the territory: volunteers, organisation, candidacy, local support.
store.getState().game.party.support = 70;
if (!store.getState().game.elections.some(item => item.type === 'comunale' && item.status === 'open')) store.fastForwardToElection('comunale');
// The programmes funded in the months before (the player's and the party's) pay off at the start of the campaign.
store.getState().game.finance.perks = { volunteers: 4, organization: 3, selection: 0.3, week: 1 };
store.getState().game.party.org.perks = { campaignOrganization: 2, campaignVolunteers: 3, selection: 0.2, week: 1 };
store.startCampaign({ electionType: 'comunale', role: 'consigliere', objective: 'win' }, [volt]);
const campaign = store.getState().campaign;
assert.ok(campaign.preparation.committees && campaign.preparation.committees.committees.length >= 2, 'La campagna registra il contributo dei comitati del comune e della provincia.');
assert.ok(campaign.history.some(item => /Comitati del territorio/.test(item.text)), 'Il contributo dei comitati è nella cronaca della campagna.');
assert.ok(campaign.history.some(item => /Programmi finanziati nei mesi scorsi: \+7 volontari · \+5 organizzazione/.test(item.text)), 'I programmi finanziati (sede, logistica, ricerca, app) contano all’avvio della campagna e restano in cronaca.');
assert.ok(Number.isFinite(campaign.preparation.committees.localSupport) && Number.isFinite(campaign.preparation.committees.nomination), 'Consenso locale e peso sulla candidatura calcolati.');

// ---------- 5. logo editor ----------
const editor = logo.createEditorState({ width: 600, height: 300, name: 'logo.png', type: 'image/png' });
assert.equal(editor.aspect, 2, 'Proporzione iniziale = quella dell’immagine.');
assert.ok(logo.untouched(editor), 'Senza modifiche il file originale resta com’è (un SVG resta vettoriale).');
let rect = logo.cropRect({ width: 600, height: 300, aspect: 2, zoom: 1 });
assert.deepEqual(rect, { sx: 0, sy: 0, sw: 600, sh: 300 }, 'Zoom 1 e proporzione naturale: tutta l’immagine.');
rect = logo.cropRect({ width: 600, height: 300, aspect: 1, zoom: 1 });
assert.ok(rect.sw === 300 && rect.sh === 300 && rect.sx === 150, 'Quadrata: il quadrato più grande al centro.');
rect = logo.cropRect({ width: 600, height: 300, aspect: 1, zoom: 0.5 });
assert.ok(rect.sw === 600 && rect.sy < 0, 'Zoom sotto 1: la cornice supera l’immagine e lascia margini trasparenti (il logo non si taglia).');
rect = logo.cropRect({ width: 600, height: 300, aspect: 1, zoom: 2, panX: 1 });
assert.ok(rect.sx + rect.sw <= 600.01 && rect.sx > 300, 'Spostamento fino al bordo destro.');
assert.deepEqual(logo.outputSize({ sw: 1200, sh: 600 }), { width: 512, height: 256 }, 'Uscita al massimo 512 px.');
assert.deepEqual(logo.outputSize({ sw: 30, sh: 30 }), { width: 64, height: 64 }, 'E mai sotto 64 px.');
const drag = panFromDrag({ ...editor, ratio: 'quadrata', zoom: 2 }, 40, 0, 0.5);
assert.ok(drag.panX < 0 && drag.panX >= -1 && drag.panY === 0, 'Trascinare a destra sposta la cornice verso sinistra.');
// Pixels: white background knocked out, the red kept, the dominant colour found.
const pixels = new Uint8ClampedArray(20 * 10 * 4);
for (let index = 0; index < 200; index++) { const x = index % 20; const red = x >= 5 && x < 15; pixels.set(red ? [200, 16, 46, 255] : [255, 255, 255, 255], index * 4); }
const background = logo.backgroundColor(pixels, 20, 10);
assert.deepEqual(background, [255, 255, 255], 'Lo sfondo si misura agli angoli.');
assert.equal(logo.dominantColor(pixels), '#c8102e', 'Colore dominante: il rosso, non il bianco dello sfondo.');
const cleared = logo.knockOut(pixels, background, 18);
assert.ok(cleared === 100 && pixels[3] === 0 && pixels[5 * 4 + 3] === 255, 'Lo sfondo uniforme diventa trasparente, il logo resta.');
assert.equal(logo.dominantColor(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 0])), null, 'Nessun colore in un’immagine bianca o trasparente.');
const meta = logo.editorMetadata({ ...editor, ratio: 'quadrata', zoom: 0.8, transparent: true }, { dominant: '#c8102e', cleared: 100 });
assert.ok(meta.crop && meta.ratio === 'quadrata' && meta.transparent && meta.original.name === 'logo.png' && meta.dominantColor === '#c8102e', 'I metadati conservano ritaglio, proporzione, trasparenza, colore e file originale.');
// The logo store keeps the editor's metadata next to source and verification.
const saved = await saveLocalLogo('party-prova', { blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), fileName: 'logo.png', source: 'https://example.org', verified: true, alt: 'Logo di prova', editor: meta });
assert.ok(saved.editor?.crop && saved.verified === true && saved.source === 'https://example.org', 'Il logo salvato conserva metadati, fonte e verifica.');
assert.equal((await getLocalLogo('party-prova')).editor.ratio, 'quadrata', 'I metadati si rileggono.');
// No forced circle: logos keep their shape.
const css = await readFile(new URL('../src/sections.css', import.meta.url), 'utf8');
assert.ok(/\.emblem\.has-logo \{[^}]*border-radius: 8px/.test(css), 'I loghi non sono forzati in un cerchio.');

console.log(`Territorio e loghi verificati: ${org.committees.length} comitati sulla mappa ISTAT (regione → ${toscana.length} province → comune), tutti gli stati (${[...seen].join(', ')}), azioni con costi, decisione per un comitato in crisi, effetti su campagna, voto e promozioni; editor dei loghi con ritaglio libero/quadrato, zoom e spostamento con margini trasparenti, sfondo trasparente, colore dominante e metadati conservati.`);
