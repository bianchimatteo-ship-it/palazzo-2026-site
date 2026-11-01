// Fondare un comitato in qualsiasi punto d'Italia (Regione → Provincia → Comune dai dati ISTAT), senza responsabile finché non lo si recluta davvero, con iscritti contati una volta
// sola tra comitati, sezioni e partito; il pannello di fondazione sta in alto e usa le liste ISTAT, non la casa del giocatore.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = globalThis.localStorage;
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const read = async name => JSON.parse(await readFile(new URL(`../src/data/real/${name}.json`, import.meta.url), 'utf8'));
const units = await read('territorial-units');
const municipalities = await read('municipalities');
const E = await import(`../src/core/committee-engine.js${v}`);
const { renderCommitteesPanel } = await import(`../src/ui/committees-view.js${v}`);
const seeded = seed => { let state = seed >>> 0 || 1; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; };
const currents = [{ id: 'riformisti', label: 'Area riformista', value: 55, strength: 40 }];
const org = { sections: [{ id: 'sezione-Toscana', region: 'Toscana', members: 2400, vitality: 58 }], priorities: { territorio: 1 }, cohesion: 58, treasury: { balance: 5000 }, growth: 0.2, cadres: 0 };
org.members = org.sections.reduce((sum, item) => sum + item.members, 0);
org.committees = E.createCommittees(org, { region: 'Toscana', units, home: { region: 'Toscana', municipality: 'Siena', provinceCode: null, provinceName: null }, currents, rank: 1, week: 1, rand: seeded(5) });
const sum = (list, field) => list.reduce((total, item) => total + item[field], 0);
const consistent = label => {
  const active = org.committees.filter(item => item.status !== 'dissoluzione');
  assert.equal(org.members, sum(org.sections, 'members'), `${label}: gli iscritti del partito sono la somma delle sezioni`);
  assert.equal(new Set(org.committees.map(item => item.id)).size, org.committees.length, `${label}: nessun comitato con lo stesso identificativo`);
  for (const province of active.filter(item => item.level === 'provincia')) assert.ok(sum(active.filter(item => item.parentId === province.id), 'members') <= province.members, `${label}: i comuni di ${province.name} non hanno più iscritti della provincia`);
  for (const regional of active.filter(item => item.level === 'regione')) {
    const section = org.sections.find(item => item.region === regional.region);
    assert.ok(sum(active.filter(item => item.parentId === regional.id && item.level === 'provincia'), 'members') <= (section?.members ?? regional.members), `${label}: le province di ${regional.region} non hanno più iscritti della regione`);
  }
};
consistent('inizio');

// 1. A comune in another region, with its province and its region founded in one action
const sicilia = units.filter(unit => unit.gameRegion === 'Sicilia');
const palermo = sicilia.find(unit => unit.name === 'Palermo');
const comuni = municipalities.filter(item => item.unit === palermo.code);
const bagheria = comuni.find(item => item.name === 'Bagheria');
assert.ok(palermo && bagheria, 'I dati ISTAT hanno Palermo e Bagheria');
const before = { committees: org.committees.length, members: org.members };
const committee = E.foundCommittee(org, { level: 'comune', name: bagheria.name, region: 'Sicilia', parentId: null, week: 2, currents, rand: seeded(1), extra: { unitCode: palermo.code, municipalityCode: bagheria.code }, ancestors: [{ level: 'regione', name: 'Sicilia' }, { level: 'provincia', name: palermo.name, extra: { unitCode: palermo.code, unitType: palermo.type } }] });
assert.equal(org.committees.length, before.committees + 3, 'Nascono il comitato regionale, quello provinciale e quello comunale');
assert.equal(committee.region, 'Sicilia', 'Il comune appartiene alla regione dei dati ISTAT, non a quella del giocatore');
const province = org.committees.find(item => item.level === 'provincia' && item.unitCode === palermo.code);
const regional = org.committees.find(item => item.level === 'regione' && item.region === 'Sicilia');
assert.equal(committee.parentId, province.id); assert.equal(province.parentId, regional.id);
assert.ok(org.sections.some(item => item.region === 'Sicilia' && item.members === regional.members), 'Si apre la federazione regionale e il comitato regionale ne è lo specchio');
assert.equal(org.members, before.members + regional.members, 'Gli iscritti del partito crescono dei soli nuovi iscritti, una volta');
for (const item of [committee, province, regional]) assert.ok(item.leader.vacant && !item.leader.player && !item.leader.person && /Nessun responsabile/.test(item.leader.label), `${item.name}: nessun responsabile fino al reclutamento`);
consistent('dopo la fondazione in Sicilia');

// 2. A second comune of the same province: another committee, another id; the province receives the new people
const second = comuni.find(item => item.name === 'Monreale');
const provinceMembers = province.members, partyMembers = org.members;
const other = E.foundCommittee(org, { level: 'comune', name: second.name, region: 'Sicilia', parentId: province.id, week: 3, currents, rand: seeded(2), extra: { unitCode: palermo.code, municipalityCode: second.code } });
assert.notEqual(other.id, committee.id, 'Due comuni della stessa provincia hanno identificativi diversi');
assert.equal(province.members, provinceMembers + other.members, 'I nuovi iscritti sono anche della provincia');
assert.equal(org.members, partyMembers + other.members, 'E del partito, una volta');
assert.throws(() => E.foundCommittee(org, { level: 'comune', name: second.name, region: 'Sicilia', parentId: province.id, week: 3, currents, rand: seeded(2), extra: { unitCode: palermo.code, municipalityCode: second.code } }), /Esiste già/, 'Lo stesso comune non si fonda due volte');
consistent('dopo il secondo comune');

// 3. A year of weekly life keeps the counts coherent; the summary counts each person once
const random = seeded(9);
for (let week = 4; week <= 110; week++) { E.advanceCommittees(org, { rand: random, week, regionalShares: { Toscana: 14, Sicilia: 9 }, nationalShare: 11, currents }); if (week % 10 === 0) consistent(`settimana ${week}`); }
const summary = E.committeeSummary(org);
const provincesAndOrphans = org.committees.filter(item => item.status !== 'dissoluzione' && (item.level === 'provincia' || (item.level === 'comune' && !org.committees.some(parent => parent.id === item.parentId && parent.level === 'provincia' && parent.status !== 'dissoluzione'))));
assert.equal(summary.members, sum(provincesAndOrphans, 'members'), 'Il riepilogo non conta due volte i comuni dentro le province');
assert.ok(summary.members <= org.members, 'Gli iscritti dei comitati locali non superano gli iscritti del partito');

// 4. A membership drive adds people at every level above, once
const target = org.committees.find(item => item.id === committee.id);
const sectionBefore = org.sections.find(item => item.region === 'Sicilia').members, provinceBefore = province.members, targetBefore = target.members;
const lines = E.applyCommitteeAction(org, target, 'recluta', { week: 120, rand: seeded(3), currents, scale: 'regionale' });
const gained = target.members - targetBefore;
assert.ok(gained > 0 && province.members === provinceBefore + gained && org.sections.find(item => item.region === 'Sicilia').members === sectionBefore + gained, `Il tesseramento (+${gained}) vale per comune, provincia e sezione`);
consistent('dopo il tesseramento');

// 5. The leader of a vacant committee weighs nothing; the panel founds from the ISTAT chain and shows who is in charge
const stance = E.leaderStance(target, {});
assert.ok(stance.weight <= 0.1 && /nessun responsabile/.test(stance.reasons.join(' ')), 'Un comitato senza responsabile non risponde a nessuno');
const game = { status: 'active', week: { index: 120, ap: 5 }, resources: { funds: 5000, politicalCapital: 10 }, party: { org, currents, affiliation: 'founder', rank: 6 } };
const state = { game, local: {}, ui: {} };
const panel = (found, ms = municipalities, region = '') => { try { return renderCommitteesPanel(state, { units, municipalities: ms, home: { region: 'Toscana', municipality: 'Siena', provinceCode: units.find(unit => unit.name === 'Siena')?.code }, found, region }); } catch (error) { return `ERR ${error.message}`; } };
let html = panel({ region: 'Calabria', unit: units.find(unit => unit.gameRegion === 'Calabria' && unit.name === 'Cosenza').code });
assert.ok(!html.startsWith('ERR'), html.slice(0, 200));
assert.ok(html.includes('class="cm-found"') && html.indexOf('cm-found') < html.indexOf('cm-grid'), 'Il pannello di fondazione sta sopra l’elenco');
assert.ok(html.indexOf('cm-found') < html.indexOf('data-view-filter-select="comitati-regione"'), 'Fondare è subito raggiungibile, prima dei filtri dell’elenco');
assert.ok(html.includes('data-view-filter-select="found-region"') && html.includes('data-view-filter-select="found-unit"') && html.includes('data-view-filter-select="found-municipality"'), 'Regione, provincia e comune si scelgono in cascata');
const calabria = units.filter(unit => unit.gameRegion === 'Calabria');
assert.ok(calabria.every(unit => html.includes(`value="${unit.code}"`)), 'Tutte le province della regione scelta sono selezionabili');
const cosenza = calabria.find(unit => unit.name === 'Cosenza');
const comuniCosenza = municipalities.filter(item => item.unit === cosenza.code);
assert.ok(comuniCosenza.every(item => html.includes(`value="${item.code}"`)), `Tutti i ${comuniCosenza.length} comuni della provincia sono selezionabili`);
assert.ok(html.includes('data-committee-level="provincia"') && html.includes(`data-committee-unit="${cosenza.code}"`) && html.includes('data-committee-region="Calabria"'), 'Senza comune scelto si fonda il comitato provinciale, con regione e codice ISTAT corretti');
html = panel({ region: 'Calabria', unit: cosenza.code, municipality: comuniCosenza[0].code });
assert.ok(html.includes('data-committee-level="comune"') && html.includes(`data-committee-municipality="${comuniCosenza[0].code}"`) && html.includes('data-committee-region="Calabria"'), 'Con il comune scelto si fonda il comitato comunale nella regione ISTAT del comune');
// no tag of the founding screen repeats an HTML attribute (the second one would be ignored by the browser): every tag in every state of the screen
for (const found of [{ region: 'Calabria', unit: '' }, { region: 'Calabria', unit: cosenza.code }, { region: 'Calabria', unit: cosenza.code, municipality: comuniCosenza[0].code }]) {
  const section = panel(found).match(/<section class="cm-found"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.ok(section, 'La schermata di fondazione c’è.');
  for (const tag of section.match(/<[a-z][^>]*>/g) ?? []) {
    const names = [...tag.matchAll(/\s([a-z][a-z0-9-]*)(?==")/g)].map(match => match[1]);
    assert.equal(new Set(names).size, names.length, `Attributo ripetuto nella schermata di fondazione: ${names.filter((name, index) => names.indexOf(name) !== index)[0]} in ${tag.slice(0, 80)}…`);
  }
}
html = panel({ region: 'Calabria', unit: '' });
assert.ok(html.includes('data-committee-level="regione"') && !html.includes('data-view-filter-select="found-municipality"'), 'Senza provincia si fonda il comitato regionale');
html = panel({ region: 'Calabria', unit: cosenza.code }, null);
assert.ok(html.includes('data-committee-load="municipalities"'), 'I comuni ISTAT si caricano a richiesta');
html = panel({ region: 'Sicilia', unit: palermo.code, municipality: bagheria.code }, municipalities, 'Sicilia');
assert.ok(!html.includes(`value="${bagheria.code}"`), 'Il comune che ha già un comitato attivo non è nell’elenco (non basta disabilitare il pulsante)');
assert.ok(!/data-committee-found="nuovo"[^>]*disabled/.test(html), 'Il pulsante resta attivo: si fonda un altro comune, non quello che esiste');
assert.ok(!html.includes(`data-committee-municipality="${bagheria.code}"`), 'E non propone di rifondare il comune che esiste');
assert.ok(html.includes('Nessun responsabile'), 'L’elenco mostra i comitati ancora senza responsabile');
assert.ok(!/undefined|NaN|\[object Object\]/.test(html.replace(/data-[a-z-]+="[^"]*"/g, '')), 'Nessun valore non valido nel pannello');
// 5b. Which places can be chosen: what the party has is not listed, a dissolved committee is free again at once, the ISTAT code tells the comuni apart, the hierarchy never leaves nothing to found
{
  const org2 = structuredClone(org); const state2 = { game: { ...game, party: { ...game.party, org: org2 } }, local: {}, ui: {} };
  const panel2 = (found, region = '') => { try { return renderCommitteesPanel(state2, { units, municipalities, home: { region: 'Toscana', municipality: 'Siena', provinceCode: units.find(unit => unit.name === 'Siena')?.code }, found, region }); } catch (error) { return `ERR ${error.message}`; } };
  const optionsOf = html => [...(html.match(/data-view-filter-select="found-municipality">([\s\S]*?)<\/select>/)?.[1] ?? '').matchAll(/value="(\d*)"/g)].map(item => item[1]);
  const palermoPick = { region: 'Sicilia', unit: palermo.code };
  // active: not listed; dissolved: listed again immediately
  const bag = org2.committees.find(item => item.municipalityCode === bagheria.code);
  assert.ok(bag && bag.status !== 'dissoluzione', 'Bagheria ha un comitato attivo');
  assert.ok(!optionsOf(panel2(palermoPick)).includes(bagheria.code), 'Attivo: Bagheria non è nell’elenco dei comuni');
  const idBefore = bag.id, historyBefore = bag.history.length;
  bag.status = 'dissoluzione';
  assert.ok(optionsOf(panel2(palermoPick)).includes(bagheria.code), 'Passato a dissoluzione: il comune è subito selezionabile');
  assert.ok(/data-committee-level="comune"[^>]*data-committee-municipality="[^"]*"/.test(panel2({ ...palermoPick, municipality: bagheria.code })) && panel2({ ...palermoPick, municipality: bagheria.code }).includes(`data-committee-municipality="${bagheria.code}"`), 'e si può rifondare');
  // refounding recovers the same record, with its id and its history, without duplicates
  const refounded = E.foundCommittee(org2, { level: 'comune', name: bagheria.name, region: 'Sicilia', parentId: null, week: 130, currents, rand: seeded(5), extra: { unitCode: palermo.code, municipalityCode: bagheria.code } });
  assert.equal(refounded.id, idBefore, 'Rifondato: lo stesso identificativo');
  assert.equal(org2.committees.filter(item => item.municipalityCode === bagheria.code).length, 1, 'Nessun duplicato');
  assert.ok(refounded.history.length > historyBefore && refounded.status !== 'dissoluzione', 'Con lo storico che c’era e la nuova voce');
  assert.ok(!optionsOf(panel2(palermoPick)).includes(bagheria.code), 'Rifondato: di nuovo fuori dall’elenco');
  // namesakes: the code decides, the name is only the fallback for records without a code (and inside the same province)
  const byName = new Map(); for (const item of municipalities) { const list = byName.get(item.name) ?? []; list.push(item); byName.set(item.name, list); }
  const twin = [...byName.values()].find(list => list.length >= 2 && new Set(list.map(item => item.unit)).size >= 2 && list.every(item => units.find(unit => unit.code === item.unit)?.gameRegion));
  assert.ok(twin, 'I dati hanno comuni omonimi in province diverse');
  const [first, other] = twin, unitFirst = units.find(unit => unit.code === first.unit), unitOther = units.find(unit => unit.code === other.unit);
  const created = E.foundCommittee(org2, { level: 'comune', name: first.name, region: unitFirst.gameRegion, parentId: null, week: 131, currents, rand: seeded(6), extra: { unitCode: unitFirst.code, municipalityCode: first.code } });
  assert.ok(!optionsOf(panel2({ region: unitFirst.gameRegion, unit: unitFirst.code })).includes(first.code), `${first.name} (${unitFirst.name}) ha il comitato`);
  assert.ok(optionsOf(panel2({ region: unitOther.gameRegion, unit: unitOther.code })).includes(other.code), `L’omonimo di ${unitOther.name} è ancora selezionabile`);
  assert.doesNotThrow(() => E.foundCommittee(org2, { level: 'comune', name: other.name, region: unitOther.gameRegion, parentId: null, week: 132, currents, rand: seeded(7), extra: { unitCode: unitOther.code, municipalityCode: other.code } }), 'L’omonimo si fonda senza «Esiste già»');
  assert.equal(new Set(org2.committees.map(item => item.id)).size, org2.committees.length, 'Due comuni omonimi hanno identificativi diversi');
  // an old record without code: the name stops the same comune of the same province, and not its namesake elsewhere
  created.municipalityCode = null;
  assert.ok(!optionsOf(panel2({ region: unitFirst.gameRegion, unit: unitFirst.code })).includes(first.code), 'Vecchio record senza codice: vale il nome nella stessa provincia');
  // the hierarchy: when a province has its committee and every comune has one, the province is not offered; the regional one too; the screen never stays with nothing to found
  const small = units.filter(unit => !['Sicilia', 'Toscana'].includes(unit.gameRegion)).map(unit => [unit, municipalities.filter(item => item.unit === unit.code)]).filter(([, list]) => list.length).sort((a, b) => a[1].length - b[1].length)[0];
  const [smallUnit, smallComuni] = small;
  const placeFor = region => ({ region, unit: smallUnit.code });
  const regionName = smallUnit.gameRegion;
  const regionals = units.filter(unit => unit.gameRegion === regionName);
  E.foundCommittee(org2, { level: 'comune', name: smallComuni[0].name, region: regionName, parentId: null, week: 133, currents, rand: seeded(8), extra: { unitCode: smallUnit.code, municipalityCode: smallComuni[0].code }, ancestors: [{ level: 'regione', name: regionName }, { level: 'provincia', name: smallUnit.name, extra: { unitCode: smallUnit.code, unitType: smallUnit.type } }] });
  for (const comune of smallComuni.slice(1)) E.foundCommittee(org2, { level: 'comune', name: comune.name, region: regionName, parentId: org2.committees.find(item => item.level === 'provincia' && item.unitCode === smallUnit.code)?.id ?? null, week: 134, currents, rand: seeded(9), extra: { unitCode: smallUnit.code, municipalityCode: comune.code } });
  const full = panel2(placeFor(regionName));
  assert.ok(!full.includes('ERR '), full.slice(0, 200));
  assert.ok(!new RegExp(`found-unit"[\\s\\S]*?value="${smallUnit.code}"[\\s\\S]*?</select>`).test(full.match(/data-view-filter-select="found-unit">[\s\S]*?<\/select>/)?.[0] ?? '') , `La provincia ${smallUnit.name}, completa, non è più offerta`);
  assert.ok(!/data-committee-found="nuovo"[^>]*disabled/.test(full) || regionals.length === 1, 'Il pannello non resta senza nulla da fondare (a meno che la regione non sia completa)');
  assert.ok(!/<option value="">Nessuna: comitato regionale<\/option>/.test(full), 'Il comitato regionale esiste: non è tra le scelte');
}
// 6. Through the career: founding costs once, leaves the committee without a person, and the manager is one person, the same in the committee and in the internal life
{
  const { createGameState, committeeAction, lifeCadre, advanceWeek } = await import(`../src/core/career-engine.js${v}`);
  const { lifeOverview } = await import(`../src/core/party-life-engine.js${v}`);
  const START = '2027-01-04';
  const STATS = { popularity: 45, reputation: 55, notoriety: 45, influence: 45, experience: 40 };
  const PLACE = { region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', province: 'Siena', provinceCode: '052', provinceType: 'Provincia' };
  const game = createGameState({ seedText: 'fondazione', currentDate: START, level: 'comunale', party: { id: 'partito-prova', label: 'Partito di prova', founder: true }, place: PLACE, stats: STATS });
  game.party.org.committees = E.createCommittees(game.party.org, { region: 'Toscana', units, home: { municipality: 'Siena', municipalityCode: '052032', provinceCode: '052' }, currents: game.party.currents, rank: 1, founder: true, week: 1, rand: seeded(4) });
  game.resources.funds = 5000; game.resources.politicalCapital = 20; game.week.ap = 6;
  const env = { currentDate: START };
  const calabriaUnit = units.find(unit => unit.gameRegion === 'Calabria' && unit.name === 'Cosenza');
  const place = municipalities.find(item => item.unit === calabriaUnit.code);
  const apBefore = game.week.ap, fundsBefore = game.resources.funds, membersBefore = game.party.org.members;
  const out = committeeAction({ game, stats: { ...STATS }, parliament: null }, env, 'fonda', { level: 'comune', name: place.name, region: 'Calabria', unitCode: calabriaUnit.code, unitType: calabriaUnit.type, unitName: calabriaUnit.name, municipalityCode: place.code });
  const founded = out.ctx.game.party.org.committees.find(item => item.municipalityCode === place.code);
  assert.ok(founded && founded.region === 'Calabria' && founded.unitCode === calabriaUnit.code, 'Il comitato nasce in Calabria con i codici ISTAT del comune');
  assert.equal(out.ctx.game.week.ap, apBefore - E.COMMITTEE_ACTIONS.fonda.cost.ap, 'Il costo in giorni è pagato una volta sola, anche se nascono tre comitati');
  assert.ok(out.ctx.game.party.org.members > membersBefore && out.ctx.game.party.org.members === out.ctx.game.party.org.sections.reduce((sum, item) => sum + item.members, 0), 'Il partito conta i nuovi iscritti una volta');
  assert.ok(founded.leader.vacant, 'Nessun responsabile alla fondazione');
  // a week later nobody has been given to it: no local leader on record, no person
  const week = advanceWeek({ game: out.ctx.game, stats: { ...STATS }, parliament: null }, { currentDate: '2027-01-11', pollDelta: 0 });
  const game2 = week.ctx.game;
  assert.ok(!(game2.party.life.cadres ?? []).some(item => item.committeeId === founded.id && item.status !== 'uscito'), 'Dopo una settimana ancora nessun dirigente: lo si recluta davvero');
  const overview = lifeOverview(game2, { currentDate: '2027-01-11' }) ?? null;
  // recruiting (from the committee's own button or from the internal life) is one operation with one cost
  const fundsAfterFound = game2.resources.funds;
  const hired = committeeAction({ game: game2, stats: { ...STATS }, parliament: null }, env, 'responsabile', { committeeId: founded.id });
  const hiredCommittee = hired.ctx.game.party.org.committees.find(item => item.id === founded.id);
  const cadre = hired.ctx.game.party.life.cadres.find(item => item.committeeId === founded.id && item.status !== 'uscito');
  assert.ok(cadre && cadre.person && hiredCommittee.leader.person?.id === cadre.person.id && !hiredCommittee.leader.vacant, 'Un solo responsabile: la stessa persona nel comitato e nella Vita interna');
  assert.equal(game2.resources.funds - hired.ctx.game.resources.funds, 200, 'Il reclutamento costa una volta sola (200 €), non il costo del comitato più quello del dirigente');
  assert.equal(hired.ctx.game.party.life.cadres.filter(item => item.committeeId === founded.id).length, 1, 'Non esiste un secondo dirigente per lo stesso comitato');
  const next = advanceWeek({ game: hired.ctx.game, stats: { ...STATS }, parliament: null }, { currentDate: '2027-01-18', pollDelta: 0 }).ctx.game;
  const cadreAfter = next.party.life.cadres.find(item => item.committeeId === founded.id && item.status !== 'uscito');
  assert.equal(cadreAfter.person.id, cadre.person.id, 'La persona resta la stessa nelle settimane successive');
  assert.equal(next.party.org.committees.find(item => item.id === founded.id).leader.person.id, cadre.person.id);
  // the person survives a save and a reload
  const reloaded = JSON.parse(JSON.stringify(next));
  assert.equal(reloaded.party.org.committees.find(item => item.id === founded.id).leader.person.id, cadre.person.id, 'Il responsabile e gli iscritti sopravvivono al salvataggio');
  assert.equal(reloaded.party.org.members, next.party.org.members);
  void overview;
}
console.log('Fondazione dei comitati verificata: ovunque in Italia con Regione → Provincia → Comune ISTAT, livelli mancanti fondati con una sola azione, nessun responsabile prima del reclutamento, iscritti contati una volta tra comitati, sezioni e partito.');
