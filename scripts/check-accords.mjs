// The accord of government: what the allies obtain for their support, written down (measures, ministries, red lines) with a weight, a term and a criterion read from what the game
// really does; negotiated with the player when he forms the Government; kept, postponed once or betrayed, with the reaction of the ally by its weight and its memory; closed with
// the Government; remembered in the next negotiations. Nothing is fulfilled by an event, only by the laws, the decrees and the ministers of the game.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const P = await import(`../src/core/parliament-engine.js${v}`);
const UI = await import(`../src/ui/parliament-mode.js${v}`);
const { checkInvariants } = await import(`../src/core/invariants.js${v}`);
const copy = value => JSON.parse(JSON.stringify(value));
const bad = text => /undefined|NaN|\[object|Infinity/.test(text.replace(/data-[a-z-]+="[^"]*"/g, ''));
const addDays = (date, days) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };

// ---------- 1. the accord of a Government the player takes part in ----------
const run = await startCareer({ seed: 'accordi-1', level: 'deputato' });
const { store } = run;
const st = () => store.getState();
store.advance(7);
const gov = () => st().parliament.government;
assert.ok(gov().accord && gov().accord.stage === 'in-vigore' && gov().accord.commitments.length >= 3, 'Un governo che include il giocatore ha un accordo in vigore.');
const accord = gov().accord;
const kinds = new Set(accord.commitments.map(item => item.kind));
assert.ok(kinds.has('misura') && kinds.has('linea-rossa'), 'Con misure e linee rosse (e ministeri per chi non ne ha).');
for (const c of accord.commitments) assert.ok(c.label && c.weight >= 1 && c.weight <= 3 && c.status === 'aperto' && (c.kind === 'linea-rossa' ? c.due === null : /^\d{4}-\d\d-\d\d$/.test(c.due)), `${c.id}: etichetta, peso, stato e scadenza.`);
assert.ok(P.accordCriterion({ kind: 'misura' }) && P.accordCriterion({ kind: 'ministero' }) && P.accordCriterion({ kind: 'linea-rossa', area: 'sanita' }), 'Ogni tipo di impegno dice come si verifica.');
const html = UI.renderParliamentPage('governo', st(), { politicians: [] });
assert.ok(html.includes('ACCORDO DI COALIZIONE') && html.includes('Criterio:') && !bad(html), 'Il pannello dell’accordo si legge e dice il criterio.');
const before = JSON.stringify(gov().accord);
store.loadGame(JSON.parse(store.exportSave()));
assert.equal(JSON.stringify(gov().accord), before, 'Dopo il ricaricamento l’accordo è lo stesso.');
const base = copy(st());
const date = base.clock.currentDate;
const nextDay = day => addDays(date, day);
const partner = c => base.parliament.government.partners?.[c.groupId];

// ---------- 2. a measure of the majority keeps a commitment (a decree or a bill approved in the matter), once ----------
const measure = accord.commitments.find(c => c.kind === 'misura' && partner(c));
assert.ok(measure, 'C’è una misura chiesta da un alleato.');
{
  const state = copy(base);
  const law = { id: 'legge-prova-misura', title: 'Legge di prova', category: 'Prova', origin: 'governo', kind: 'ddl', stage: 'approved', status: 'approved', introducedAt: date, updatedAt: date, policy: { area: measure.area, financing: 'deficit' }, votes: [], auto: true, sponsor: { kind: 'governo', groupId: null } };
  state.parliament.laws = [law, ...state.parliament.laws];
  state.parliament = P.record(state.parliament, date, 'iter-approved', 'Approvata la legge di prova.', { lawId: law.id, stage: 'approved', kind: 'ddl', origin: 'governo' });
  const satisfaction = state.parliament.government.partners[measure.groupId].satisfaction, relation = state.parliament.relations?.[measure.groupId]?.value;
  const out = P.tickAccord(state.parliament, date, { temper: {} });
  const kept = out.parliament.government.accord.commitments.find(c => c.id === measure.id);
  assert.equal(kept.status, 'mantenuto', 'Una legge approvata nella materia mantiene l’impegno.');
  assert.ok(kept.evidence?.lawId === law.id && out.settled.some(item => item.commitment.id === measure.id && item.outcome === 'mantenuto'), 'Con la prova: quale legge, quando.');
  assert.ok(out.parliament.government.partners[measure.groupId].satisfaction > satisfaction && (relation === undefined || out.parliament.relations[measure.groupId].value >= relation), 'L’alleato è più soddisfatto e i rapporti non peggiorano.');
  assert.ok(out.parliament.history.some(entry => entry.type === 'accordo-impegno' && entry.details.outcome === 'mantenuto'), 'Il registro lo racconta.');
  const again = P.tickAccord(out.parliament, date, { temper: {} });
  assert.equal(again.settled.length, 0, 'Una legge conta una volta sola.');
}

// ---------- 3. a red line crossed is a betrayal, harder on a heavy ally ----------
const redLine = accord.commitments.find(c => c.kind === 'linea-rossa' && c.area && partner(c));
assert.ok(redLine, 'C’è una linea rossa su un tema.');
{
  const state = copy(base);
  const law = { id: 'legge-prova-rossa', title: 'Legge contro la linea rossa', category: 'Prova', origin: 'governo', kind: 'ddl', stage: 'approved', status: 'approved', introducedAt: date, updatedAt: date, policy: { area: redLine.area, financing: 'deficit' }, votes: [], auto: true, sponsor: { kind: 'governo', groupId: null } };
  state.parliament.laws = [law, ...state.parliament.laws];
  state.parliament = P.record(state.parliament, date, 'iter-approved', 'Approvata la legge contro la linea rossa.', { lawId: law.id, stage: 'approved', kind: 'ddl', origin: 'governo' });
  const satisfaction = state.parliament.government.partners[redLine.groupId].satisfaction;
  const out = P.tickAccord(state.parliament, date, { temper: {} });
  const broken = out.parliament.government.accord.commitments.find(c => c.id === redLine.id);
  assert.equal(broken.status, 'tradito', 'Una legge nella materia della linea rossa la rompe.');
  assert.ok(out.parliament.government.partners[redLine.groupId]?.satisfaction < satisfaction || !out.parliament.government.partners[redLine.groupId], 'L’alleato ne soffre (o esce dalla maggioranza).');
  assert.ok(out.settled[0].text.includes('tradito') && out.parliament.history.some(entry => entry.type === 'accordo-impegno' && entry.details.outcome === 'tradito'), 'Il tradimento è raccontato.');
  // The memory of the ally makes it harsher.
  const grudge = P.tickAccord(copy(state.parliament), date, { temper: { [redLine.groupId]: 3 } });
  const gPartner = grudge.parliament.government.partners[redLine.groupId], oPartner = out.parliament.government.partners[redLine.groupId];
  assert.ok(!gPartner || !oPartner || gPartner.satisfaction <= oPartner.satisfaction, 'Chi ricorda vecchi tradimenti reagisce peggio.');
  // And before it happens, the player is told: the preview of a policy that would cross the line.
  const conflicts = P.accordConflicts(base.parliament, { area: redLine.area, financing: 'deficit' });
  assert.ok(conflicts.breaks.some(c => c.id === redLine.id), 'L’anteprima di una politica avvisa della linea rossa che rompe.');
  assert.ok(P.accordConflicts(base.parliament, { area: measure.area }).serves.some(c => c.id === measure.id), 'E di ciò che accontenta.');
}

// ---------- 4. a term passes: postponed once, then betrayed, later and harder ----------
{
  const state = copy(base);
  const target = state.parliament.government.accord.commitments.find(c => c.id === measure.id);
  const past = addDays(date, -1);
  state.parliament.government.accord.commitments = state.parliament.government.accord.commitments.map(c => c.id === target.id ? { ...c, due: past } : c);
  const first = P.tickAccord(state.parliament, date, { temper: {} });
  const postponed = first.parliament.government.accord.commitments.find(c => c.id === target.id);
  assert.ok(postponed.status === 'rinviato' && postponed.postponed === 1 && postponed.due > date && postponed.originalDue === past, 'Una scadenza mancata si rinvia una volta, con una nuova data.');
  const afterFirst = first.parliament.government.partners[target.groupId].satisfaction;
  const second = P.tickAccord(first.parliament, addDays(postponed.due, 1), { temper: {} });
  const betrayed = second.parliament.government.accord.commitments.find(c => c.id === target.id);
  assert.equal(betrayed.status, 'tradito', 'La seconda scadenza mancata è un tradimento.');
  assert.ok((second.parliament.government.partners[target.groupId]?.satisfaction ?? 0) < afterFirst, 'E costa di più del rinvio.');
}

// ---------- 5. a ministry asked is kept by giving it ----------
const ministry = accord.commitments.find(c => c.kind === 'ministero');
if (ministry) {
  const state = copy(base);
  const taken = state.parliament.government.ministers.find(item => item.portfolio === ministry.portfolio && !item.endedAt);
  if (taken) taken.endedAt = date;
  state.parliament = P.assignMinister(state.parliament, ministry.portfolio, ministry.groupId, date);
  const out = P.tickAccord(state.parliament, date, { temper: {} });
  assert.equal(out.parliament.government.accord.commitments.find(c => c.id === ministry.id).status, 'mantenuto', 'Dare il ministero chiesto mantiene l’impegno.');
}

// ---------- 6. the Government of others: the allies react, the stability is not touched ----------
{
  const state = copy(base);
  assert.ok(state.parliament.government.primeMinister !== 'player', 'Questo governo non è guidato dal giocatore.');
  const stability = state.parliament.government.stability;
  const law = { id: 'legge-prova-rossa2', title: 'Contro la linea rossa', category: 'Prova', origin: 'governo', kind: 'ddl', stage: 'approved', status: 'approved', introducedAt: date, updatedAt: date, policy: { area: redLine.area }, votes: [], auto: true, sponsor: { kind: 'governo', groupId: null } };
  state.parliament.laws = [law, ...state.parliament.laws];
  state.parliament = P.record(state.parliament, date, 'iter-approved', 'Approvata.', { lawId: law.id, stage: 'approved', kind: 'ddl', origin: 'governo' });
  const out = P.tickAccord(state.parliament, date, { temper: {} });
  assert.equal(out.parliament.government.stability, stability, 'La stabilità di un governo non guidato dal giocatore non cambia per l’accordo: reagiscono gli alleati.');
}

// ---------- 7. the Government of the player: negotiation, confidence, concession, stability ----------
async function premierCareer(seed) {
  const career = await startCareer({ seed, level: 'deputato' });
  career.store.advance(7);
  const save = JSON.parse(career.store.exportSave());
  const group = save.parliament.player.groupId;
  const allies = save.parliament.government.coalitionGroupIds.filter(id => id !== group);
  let parliament = { ...save.parliament, government: null };
  parliament = P.formGovernment({ ...parliament, resources: { ...parliament.resources, politicalCapital: 90 } }, [group, ...allies], save.clock.currentDate);
  save.parliament = { ...parliament, government: { ...parliament.government, formedBy: 'player', premierGroupId: group } };
  save.game.resources.politicalCapital = 90;
  save.society.crisisSeverity = 0;
  career.store.loadGame(save);
  career.store.advance(7);
  return career;
}
const pm = await premierCareer('accordi-2');
const pmSt = () => pm.store.getState();
const pmGov = () => pmSt().parliament.government;
assert.equal(pmGov().accord.stage, 'trattativa', 'Chi forma il governo negozia l’accordo prima della fiducia.');
const open = pmGov().accord.commitments.filter(c => !c.answer && c.status === 'aperto');
assert.ok(open.length >= 3, 'Le richieste degli alleati aspettano una risposta.');
const reducible = open.find(c => c.kind !== 'linea-rossa'), redOpen = open.find(c => c.kind === 'linea-rossa');
const satisfactionOf = c => pmGov().partners?.[c.groupId]?.satisfaction;
const beforeReduced = satisfactionOf(reducible);
pm.store.answerAccord(reducible.id, 'ridotta');
const reduced = pmGov().accord.commitments.find(c => c.id === reducible.id);
assert.ok(reduced.answer === 'ridotta' && reduced.weight <= reducible.weight && reduced.termDays > reducible.termDays && satisfactionOf(reducible) < beforeReduced, 'Accogliere in forma ridotta: più tempo, meno peso, l’alleato ci resta un po’ male.');
assert.throws(() => pm.store.answerAccord(redOpen.id, 'ridotta'), /linea rossa/i, 'Una linea rossa non si ridimensiona.');
const beforeRefused = satisfactionOf(redOpen);
pm.store.answerAccord(redOpen.id, 'respinta');
assert.ok(pmGov().accord.commitments.find(c => c.id === redOpen.id).status === 'respinta' && satisfactionOf(redOpen) < beforeRefused, 'Respingere una richiesta pesa sull’alleato, che se lo ricorda.');
assert.throws(() => pm.store.answerAccord(redOpen.id, 'accolta'), /già una risposta/, 'Una risposta sola.');
const negotiation = UI.renderParliamentPage('governo', pmSt(), { politicians: [] });
assert.ok(negotiation.includes('data-accord-answer') && !bad(negotiation), 'La trattativa ha i pulsanti di risposta.');
pm.store.voteGovernmentConfidence?.();
assert.ok(pmGov().status === 'active' && pmGov().accord.stage === 'in-vigore', 'Con la fiducia l’accordo entra in vigore.');
const signed = pmGov().accord.commitments.filter(c => c.status === 'aperto');
assert.ok(signed.every(c => c.signedAt && (c.kind === 'linea-rossa' || c.due)), 'Le richieste senza risposta valgono come accolte e le scadenze partono.');
assert.ok(pmGov().accord.commitments.find(c => c.id === redOpen.id).status === 'respinta', 'Ciò che era stato respinto non vincola.');
// A concession to an ally is a new commitment with a term, paid in capital, once every three months.
const ally = Object.keys(pmGov().partners)[0];
const capital = pmSt().game.resources.politicalCapital;
pm.store.offerAccordConcession(ally);
assert.ok(pmGov().accord.commitments.some(c => c.concession && c.groupId === ally && c.status === 'aperto') && pmSt().game.resources.politicalCapital < capital, 'Una concessione è un nuovo impegno con scadenza e costa capitale.');
assert.throws(() => pm.store.offerAccordConcession(ally), /dodici settimane|capitale/i, 'Una concessione ogni dodici settimane per alleato.');
// Keeping and breaking commitments moves the Prime Minister's own stability.
{
  const state = copy(pmSt());
  const m = state.parliament.government.accord.commitments.find(c => c.kind === 'misura' && c.status === 'aperto');
  const law = { id: 'legge-prova-pm', title: 'Misura di prova', category: 'Prova', origin: 'governo', kind: 'ddl', stage: 'approved', status: 'approved', introducedAt: state.clock.currentDate, updatedAt: state.clock.currentDate, policy: { area: m.area }, votes: [], auto: true, sponsor: { kind: 'governo', groupId: null } };
  state.parliament.laws = [law, ...state.parliament.laws];
  state.parliament = P.record(state.parliament, state.clock.currentDate, 'iter-approved', 'Approvata.', { lawId: law.id, stage: 'approved', kind: 'ddl', origin: 'governo' });
  const stability = state.parliament.government.stability;
  const out = P.tickAccord(state.parliament, state.clock.currentDate, { temper: {} });
  assert.ok(out.parliament.government.stability > stability, 'Mantenere un impegno rafforza il governo del giocatore.');
}

// ---------- 8. memory: who was betrayed asks for more next time; the accord ends with the Government ----------
{
  const state = copy(pmSt());
  const fresh = P.draftAccord({ ...state.parliament, government: { ...state.parliament.government, accord: undefined } }, state.clock.currentDate, { temper: {}, stage: 'trattativa' });
  const withGrudge = P.draftAccord({ ...state.parliament, government: { ...state.parliament.government, accord: undefined } }, state.clock.currentDate, { temper: Object.fromEntries(Object.keys(state.parliament.government.partners).map(id => [id, 3])), stage: 'trattativa' });
  const term = list => list.government.accord.commitments.filter(c => c.kind === 'misura').reduce((sum, c) => sum + c.termDays, 0) / Math.max(1, list.government.accord.commitments.filter(c => c.kind === 'misura').length);
  const weight = list => list.government.accord.commitments.reduce((sum, c) => sum + c.weight, 0);
  assert.ok(term(withGrudge) < term(fresh) && weight(withGrudge) >= weight(fresh), 'Alleati con la memoria di tradimenti chiedono scadenze più strette e pesi maggiori.');
  const ended = P.closeAccord(state.parliament, state.clock.currentDate, 'il governo è finito');
  assert.ok(ended.government.accord.stage === 'chiuso' && ended.government.accord.commitments.every(c => !['aperto', 'rinviato'].includes(c.status)), 'Con il governo l’accordo si chiude e gli impegni aperti decadono.');
  const changed = P.ensureAccord({ ...state.parliament, government: { ...state.parliament.government, id: 'governo-nuovo' } }, state.clock.currentDate, { temper: {} });
  assert.equal(changed.government.accord.stage, 'chiuso', 'Un altro governo non eredita l’accordo.');
}
// ---------- 9. the kinds of Government live differently ----------
{
  const state = copy(base);
  const gov0 = state.parliament.government;
  gov0.partners = Object.fromEntries(Object.entries(gov0.partners).map(([id, item]) => [id, { ...item, satisfaction: 30, demand: null }]));
  const tick = kind => { const parliament = copy(state.parliament); parliament.government.majorityKind = kind; parliament.government.ministers = []; return P.advanceGovernmentWeek(parliament, date, 0.5, () => 0.1); };
  const demands = out => Object.values(out.government.partners ?? {}).map(item => item.demand?.type).filter(Boolean);
  const technical = tick('governo-del-presidente'), born = tick('coalizione-post-voto'), grand = tick('grande-coalizione');
  assert.ok(demands(born).length > 0 && demands(born).includes('ministero'), 'Una maggioranza nata in Parlamento ha alleati che chiedono ministeri.');
  assert.ok(demands(technical).length > 0 && demands(technical).every(type => type === 'misura'), 'Un governo tecnico non ha ministeri da dare: gli alleati chiedono solo misure.');
  assert.ok(technical.government.stability >= born.government.stability, 'Il governo del Presidente parte più saldo di una maggioranza nata in Parlamento.');
  const mood = out => Object.values(out.government.partners).reduce((sum, item) => sum + item.satisfaction, 0);
  assert.ok(mood(grand) < mood(technical), 'In una grande coalizione gli alleati si logorano prima; con un tecnico meno.');
}
assert.deepEqual(checkInvariants(st()).issues, [], 'Invarianti con l’accordo.');
console.log('Accordi di coalizione verificati: impegni (misure, ministeri, linee rosse) con peso, scadenza e criterio; trattativa con risposta accolta/ridotta/respinta e linee rosse non ridimensionabili; mantenuti da leggi e ministri veri (una volta sola, con la prova), traditi da una linea rossa varcata, rinviati una volta e poi traditi; l’alleato reagisce secondo peso e memoria, la stabilità cambia solo se guida il giocatore; concessioni con costo e tempo; anteprima delle politiche; memoria nelle trattative future; chiusura con il governo; salvataggi coerenti.');
process.exit(0);
