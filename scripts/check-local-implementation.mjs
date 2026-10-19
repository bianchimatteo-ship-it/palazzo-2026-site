// Il voto non è la misura. Un atto approvato dal consiglio ha un effetto politico (impegni, influenza, attenzione); i servizi del territorio e i cittadini cambiano solo
// quando l'amministrazione attua la misura: in tempo e bene, in ritardo, senza risultati o mai. Una mozione non ha alcuna misura. L'effetto non esce dal territorio dell'ente:
// alla regione arriva solo il peso del comune (o della provincia) nella regione, mai una quota fissa.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const L = await import(`../src/core/local-engine.js${v}`);
const rules = await import(`../src/core/municipal-rules.js${v}`);
const { regionShareOf, UNKNOWN_SHARE } = await import(`../src/core/territory-share.js${v}`);
const { seededRandom } = await import(`../src/core/vote-engine.js${v}`);
const { advanceDays } = await import(`../src/core/time.js${v}`);

const groups = [
  { id: 'pd', label: 'Partito Democratico', axis: -1, seats: 9, side: 'maggioranza' }, { id: 'avs', label: 'Alleanza Verdi e Sinistra', axis: -2, seats: 3, side: 'maggioranza' },
  { id: 'civ', label: 'Lista civica', axis: 0, seats: 2, side: 'maggioranza' }, { id: 'fdi', label: 'Fratelli d’Italia', axis: 2, seats: 6, side: 'opposizione' },
  { id: 'lega', label: 'Lega', axis: 2, seats: 2, side: 'opposizione' }, { id: 'az', label: 'Azione', axis: 0.5, seats: 2, side: 'opposizione' }
];
const territory = { servizi: 50, sicurezza: 50, ambiente: 50, trasporti: 50, infrastrutture: 50, economia: 50 };
const make = (extra = {}) => ({ ...L.createInstitution({ kind: 'comune', name: 'Comune di prova', date: '2027-01-10', role: 'sindaco', side: 'maggioranza', playerGroupId: 'pd', leaderGroupId: 'pd', leaderIsPlayer: true, groups, territory }), ...extra });
const week = (inst, date) => L.advanceInstitutionWeek(inst, { date, rand: seededRandom(`impl|${date}`) });
const at = (inst, id, date) => ({ ...inst, acts: inst.acts.map(item => item.id === id ? { ...item, stage: 'aula', nextStepAt: date } : item) });
const approve = (inst, area, category, extra = {}) => {
  const proposed = L.proposeLocalAct(inst, area, '2027-01-10', { category, ...extra });
  const act = proposed.acts.at(-1);
  const out = week(at(proposed, act.id, '2027-01-17'), '2027-01-17');
  assert.equal(out.inst.acts.find(item => item.id === act.id).stage, 'approvato', `${category}: l'atto è approvato`);
  return { act, out };
};
const run = (inst, weeks, from = '2027-01-17', prepare = null) => {
  let state = inst, control = null; const events = [];
  for (let i = 1; i <= weeks; i++) { const date = advanceDays(from, i * 7); if (prepare) state = prepare(state, i); const res = week(state, date); state = res.inst; events.push(...res.events); }
  return { inst: state, events };
};
const sicurezza = inst => inst.indicators.sicurezza;

// 1. A motion: only a political commitment, no measure, no effect on the services, however long it takes.
{
  const councillor = L.createInstitution({ kind: 'comune', name: 'Comune di prova', date: '2027-01-10', role: 'consigliere', side: 'maggioranza', playerGroupId: 'avs', leaderGroupId: 'pd', groups, territory });
  const { act, out } = approve(councillor, 'sicurezza', 'mozione');
  assert.equal(act.measure ?? null, null, 'La mozione non ha una misura');
  assert.ok(out.inst.commitments.some(item => item.actId === act.id && item.status === 'aperto'), 'La mozione approvata impegna politicamente la giunta');
  assert.ok(!out.events.some(item => ['effetti', 'attuazione'].includes(item.type)) && !(out.inst.implementations ?? []).length, 'Nessun effetto sui servizi con il voto della mozione');
  const later = run(out.inst, 12, '2027-01-17');
  const idle = run(councillor, 12, '2027-01-17');
  assert.ok(Math.abs(sicurezza(later.inst) - sicurezza(idle.inst)) < 1.5 && !later.events.some(item => item.type === 'effetti' && item.actId === act.id), 'Passate le settimane la sicurezza non migliora per una mozione');
  const vote = out.events.find(item => item.type === 'atto-votato' && item.actId === act.id);
  assert.ok(vote?.passed && vote.category === 'mozione' && vote.measure === null, 'L’esito della mozione dichiara che non ha una misura');
}

// 2. A measure approved but never carried out (provisional budget, no money): nothing moves, and it is said.
{
  const base = make();
  const { act, out } = approve(base, 'sicurezza', 'regolamento');
  assert.ok(!out.events.some(item => item.type === 'effetti' && item.actId === act.id), 'Il voto non sposta i servizi');
  const entry = out.inst.implementations.find(item => item.actId === act.id);
  assert.equal(entry.status, 'in-attuazione');
  const broke = state => ({ ...state, budget: { ...state.budget, provisional: true } });
  const res = run(out.inst, 30, '2027-01-17', broke);
  const final = res.inst.implementations.find(item => item.actId === act.id);
  assert.equal(final.status, 'non-attuato', 'Senza fondi la misura non viene attuata');
  assert.ok(res.events.some(item => item.type === 'attuazione' && item.actId === act.id && item.status === 'in-ritardo') && res.events.some(item => item.type === 'attuazione' && item.actId === act.id && item.status === 'non-attuato'), 'Prima il ritardo, poi la mancata attuazione');
  assert.ok(!res.events.some(item => item.type === 'effetti' && item.actId === act.id) && !res.inst.effects.some(item => item.actId === act.id), 'Nessun effetto su servizi o regione per una misura non attuata');
}

// 3. A measure that is late: the budget is provisional for a while, then it is carried out, later than planned.
{
  const { act, out } = approve(make(), 'sicurezza', 'regolamento');
  const planned = out.inst.implementations.find(item => item.actId === act.id).startsAt;
  const tight = (state, i) => ({ ...state, budget: { ...state.budget, provisional: i <= 4 } });
  const res = run(out.inst, 30, '2027-01-17', tight);
  const final = res.inst.implementations.find(item => item.actId === act.id);
  assert.ok(['attuato', 'inefficace'].includes(final.status) && final.closedAt > planned, `La misura arriva in ritardo (prevista ${planned}, attuata ${final.closedAt})`);
  assert.ok(res.events.some(item => item.type === 'attuazione' && item.actId === act.id && item.status === 'in-ritardo'), 'Il ritardo viene segnalato');
}

// 4. A measure that does not work: a thin budget and an unstable executive carry it out with little strength; the services barely move.
{
  const weak = make();
  weak.budget = { ...weak.budget, margin: 6 }; weak.executive = { ...weak.executive, stability: 5 };
  const { act, out } = approve(weak, 'sicurezza', 'regolamento');
  const control = run(make({ budget: weak.budget, executive: weak.executive }), 40, '2027-01-17');
  const res = run(out.inst, 40, '2027-01-17');
  const done = res.events.find(item => item.type === 'attuazione' && item.actId === act.id && !['in-attuazione', 'in-ritardo'].includes(item.status));
  assert.equal(done?.status, 'inefficace', `Con poca forza la misura è attuata ma inefficace (efficacia ${done?.efficacy})`);
  const gain = sicurezza(res.inst) - sicurezza(control.inst);
  assert.ok(gain >= 0 && gain <= act.measure.indicators.sicurezza * 0.2 + 0.4, `L’effetto di una misura inefficace è minimo (${gain.toFixed(2)} su ${act.measure.indicators.sicurezza})`);
}

// 5. A measure that works: time, then the effect in proportion to the strength; the region gets a small, proportionate share.
{
  const strong = make();
  strong.budget = { ...strong.budget, margin: 90 }; strong.executive = { ...strong.executive, stability: 90 };
  const { act, out } = approve(strong, 'sicurezza', 'regolamento');
  const entry = out.inst.implementations.find(item => item.actId === act.id);
  assert.ok(entry.startsAt >= advanceDays('2027-01-17', 14), 'La misura parte dopo almeno due settimane');
  const control = run(make({ budget: strong.budget, executive: strong.executive }), 40, '2027-01-17');
  const res = run(out.inst, 40, '2027-01-17');
  const done = res.events.find(item => item.type === 'attuazione' && item.actId === act.id && item.status === 'attuato');
  assert.ok(done && done.efficacy >= 0.7, `Misura attuata con efficacia ${done?.efficacy}`);
  const gain = sicurezza(res.inst) - sicurezza(control.inst);
  assert.ok(Math.abs(gain - act.measure.indicators.sicurezza * done.efficacy) < 0.5, `Il guadagno (${gain.toFixed(2)}) segue la misura per l’efficacia (${(act.measure.indicators.sicurezza * done.efficacy).toFixed(2)})`);
  const regional = res.events.find(item => item.type === 'effetti' && item.actId === act.id);
  assert.ok(regional && regional.indicators.sicurezza > 0 && regional.indicators.sicurezza < gain, 'Alla regione arriva solo una piccola parte');
}

// 6. The territory: the share of the region is the weight of the comune (or province) in the region, never a flat quota.
{
  const index = rules.indexMunicipalPopulation(JSON.parse(await readFile(new URL('../src/data/real/municipal-population.json', import.meta.url), 'utf8')));
  rules.setMunicipalPopulationIndex(index);
  const region = rules.residentsOfRegion('Piemonte');
  const village = make({ region: 'Piemonte', place: { region: 'Piemonte', municipalityCode: '001001' } });
  const expected = rules.residentsOfMunicipality('001001') / region;
  assert.ok(Math.abs(regionShareOf(village) - expected) < 0.0001 && regionShareOf(village) < 0.005, `Un paese di ${rules.residentsOfMunicipality('001001')} abitanti pesa ${regionShareOf(village)} nella regione`);
  const city = make({ region: 'Piemonte', place: { region: 'Piemonte', municipalityCode: '001272' } });
  assert.ok(regionShareOf(city) > regionShareOf(village) && regionShareOf(city) <= 0.15, 'Il capoluogo pesa di più ma entro il tetto');
  const unknown = make({ region: 'Piemonte', place: { region: 'Piemonte', municipalityCode: '999999' } });
  assert.equal(regionShareOf(unknown), UNKNOWN_SHARE, 'Senza popolazione nota la quota è quella dichiarata, minima');
  assert.equal(regionShareOf(make({ kind: 'regione' })), 1, 'La regione muove i propri indicatori per intero');
  // the effect on the region is proportionate: a village moves it a fraction of what a flat quota gave
  const strong = village; strong.budget = { ...strong.budget, margin: 90 }; strong.executive = { ...strong.executive, stability: 90 };
  const { act, out } = approve(strong, 'sicurezza', 'regolamento');
  const regional = run(out.inst, 30, '2027-01-17').events.find(item => item.type === 'effetti' && item.actId === act.id);
  assert.ok(regional.indicators.sicurezza === 0 || regional.indicators.sicurezza < act.measure.indicators.sicurezza * 0.01, `Un paese non muove la regione (${regional.indicators.sicurezza} su ${act.measure.indicators.sicurezza})`);
  rules.setMunicipalPopulationIndex(new Map());
}
console.log('Dal voto alla misura verificato: la mozione non ha misura; una misura approvata va in attuazione e muove i servizi solo se attuata (in ritardo, inefficace o mai); alla regione arriva il peso reale del comune.');
