// A deputy career in the real XIX legislature: the Government falls and the following weeks must lead to
// consultations, a mandate, a vote of confidence and a new Government (or to the dissolution and a vote) —
// never to a long stretch without any Government. A quick check: a few dozen weeks, no long simulation.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const realData = await import(`../src/data/repositories/real-data.js${v}`);
await realData.loadRealDatabase();
await realData.loadRealCollections(['parties', 'politicalMovements', 'coalitions', 'twoPerThousand', 'realPolls', 'parliamentaryGroups', 'politicians', 'government', 'politicalFigures', 'electoralLists', 'partyMemberships']);
const geography = await realData.loadRealDocument('electoralGeography');
const db = () => realData.realDatabase;
const links = await import(`../src/data/repositories/party-links.js${v}`);
const govRef = await import(`../src/data/repositories/government-reference.js${v}`);

const WEEKS = 16;
const { advanceDays } = await import(`../src/core/time.js${v}`);
const { CALENDAR_RULES } = await import(`../src/core/calendar-planner.js${v}`);
const CALENDAR_LIMIT = CALENDAR_RULES.dissolveWithinDays;
const IN_PROGRESS = ['insediamento', 'consultazioni', 'incarico', 'fiducia'];
// The government is "there" when it is in office; the caretaker one after a dissolution is not a way out of the crisis.
const GOVERNING = ['active', 'crisis'];

async function scenario(tag, warmup = 0, heldDaysAgo = null) {
  mem.clear();
  const { store } = await import(`../src/core/store.js${v}&governo=${tag}`);
  store.setRealReference({ twoPerThousand: db().twoPerThousand, parties: db().parties, movements: db().politicalMovements, coalitions: db().coalitions, polls: db().realPolls, startDate: db().manifest.snapshotDate, governingIds: links.governingEntityIds(db()) });
  store.setReferenceGovernment(govRef.referenceGovernmentSpec(db()));
  store.setElectoralGeography(geography);
  store.createCareer({ firstName: 'Dino', lastName: 'Deputato', birthDate: '1975-03-03', gender: 'uomo', region: 'Lombardia', municipality: 'Bergamo', municipalityCode: '016024', previousProfession: 'Avvocato', initialLevel: 'deputato', parliamentaryGroupId: 'cam-xix-02', parliamentStartMode: 'real-context', partyMode: 'existing', partyId: db().parties.find(party => /democratic|PD/i.test(`${party.id}${party.abbreviation ?? ''}`))?.id ?? db().parties[0].id }, db().parties, db().parliamentaryGroups);
  const give = () => { const s = store.getState(); s.game.week.ap = Math.max(s.game.week.ap, 6); s.game.resources.politicalCapital = Math.max(s.game.resources.politicalCapital, 45); };
  let s = store.getState();
  assert.equal(s.national.legislature.number, 19, 'La carriera parte nella XIX legislatura reale.');
  assert.ok(s.parliament.government && GOVERNING.includes(s.parliament.government.status), `${tag}: all’inizio c’è un governo in carica (${s.parliament.government?.status}).`);
  for (let week = 0; week < warmup; week++) { for (const item of [...store.getState().game.inbox]) { try { give(); store.resolveAgendaItem(item.id, item.defaultChoice); } catch { /* not this week */ } } store.advance(7); }
  s = store.getState();
  if (warmup) assert.ok(GOVERNING.includes(s.parliament.government.status), `${tag}: dopo ${warmup} settimane il governo è ancora in carica (${s.parliament.government.status}).`);
  const first = s.parliament.government;
  const today = s.clock.currentDate;
  if (heldDaysAgo !== null) {
    // a round of voting held a short time ago keeps the next one 180 days away: the Chambers must not be dissolved into a months-long wait
    s.game.elections.push({ ...s.game.elections.find(item => item.type === 'europee'), id: 'prova-appena-votata', type: 'regionale', status: 'held', early: false, electionDate: advanceDays(today, -heldDaysAgo) });
    s.parliament.government.status = 'fallen'; s.parliament.government.fallenAt = today;
  }
  // The Government falls: the same state the confidence vote or a withdrawal leaves behind.
  s.parliament.government.status = 'fallen';
  s.parliament.government.fallenAt = s.clock.currentDate;
  const log = [];
  let waitMax = 0, weeksWithout = 0, longest = 0, phases = new Set(), resolved = null;
  for (let week = 0; week < WEEKS; week++) {
    for (const item of [...store.getState().game.inbox]) { try { give(); store.resolveAgendaItem(item.id, item.defaultChoice); } catch { /* not this week */ } }
    const now = store.getState();
    if (now.national.formation?.playerAccepted && now.parliament.government?.status === 'awaiting-confidence') { give(); try { store.voteGovernmentConfidence(); } catch { /* not yet */ } }
    if (heldDaysAgo !== null && week === 1) { const now2 = store.getState(); if (now2.national.formation) now2.national.formation.presidentChoice = 'dissolve'; }
    store.advance(7);
    const after = store.getState();
    const government = after.parliament.government;
    const phase = after.national.formation?.phase ?? null;
    if (phase) phases.add(phase);
    const early = after.game.elections.find(item => item.type === 'politiche' && item.early && item.status !== 'held');
    if (early) waitMax = Math.max(waitMax, Math.round((Date.parse(early.electionDate) - Date.parse(after.clock.currentDate)) / 86400000));
    log.push(`${after.clock.currentDate} ${government?.status ?? '-'}/${phase ?? '-'}${government?.id === first.id ? '' : ' (nuovo)'}`);
    const governing = GOVERNING.includes(government?.status) && government.id !== first.id;
    weeksWithout = governing ? 0 : weeksWithout + 1;
    longest = Math.max(longest, weeksWithout);
    const dissolved = after.game.elections.some(item => item.type === 'politiche' && item.early && item.status !== 'held') || after.national.legislature.number !== 19;
    if (!resolved && (governing || dissolved)) resolved = { week: week + 1, governing, dissolved };
    if (resolved && week + 1 >= resolved.week + 2) break;
  }
  return { store, log, longest, phases, resolved, first, waitMax };
}

const base = await scenario('caduta');
const trace = base.log.slice(0, 12).join('\n  ');
assert.ok(base.phases.has('consultazioni') || base.phases.has('insediamento') || base.phases.has('incarico'), `La caduta apre le consultazioni (fasi viste: ${[...base.phases].join(', ') || 'nessuna'}).\n  ${trace}`);
assert.ok(base.resolved, `Entro ${WEEKS} settimane c’è un nuovo governo in carica oppure le Camere sono sciolte.\n  ${base.log.join('\n  ')}`);
assert.ok(base.resolved.week <= 12, `La crisi si chiude in poche settimane (${base.resolved.week}): nessuna carriera resta settimane intere senza governo.\n  ${base.log.join('\n  ')}`);
{
  const s = base.store.getState();
  assert.ok(base.resolved.governing, 'Dopo la caduta nasce un nuovo governo con la fiducia (le Camere della XIX legislatura restano in carica).');
  assert.ok(GOVERNING.includes(s.parliament.government.status) && s.parliament.government.id !== base.first.id, 'Il governo in carica è un altro governo.');
  assert.ok((s.parliament.government.confidenceVotes ?? []).length > 0 || s.parliament.government.formedAt, 'Il nuovo governo ha una data di formazione e un voto di fiducia.');
  assert.equal(s.national.formation.phase, 'completata', 'La formazione è conclusa, senza forzare lo stato del governo.');
  assert.equal(s.national.legislature.number, 19, 'La crisi non cambia legislatura.');
}

// A second fall of the Government just formed: new consultations, not the previous crisis counted twice.
{
  const store = base.store;
  const s = store.getState();
  const second = s.parliament.government;
  s.parliament.government.status = 'fallen';
  s.parliament.government.fallenAt = s.clock.currentDate;
  const seen = [];
  let weeks = 0;
  for (; weeks < 12; weeks++) {
    for (const item of [...store.getState().game.inbox]) { try { store.resolveAgendaItem(item.id, item.defaultChoice); } catch { /* not this week */ } }
    const now = store.getState();
    if (now.national.formation?.playerAccepted && now.parliament.government?.status === 'awaiting-confidence') { try { store.voteGovernmentConfidence(); } catch { /* not yet */ } }
    store.advance(7);
    const after = store.getState();
    seen.push(`${after.clock.currentDate} ${after.parliament.government?.status}/${after.national.formation?.phase}`);
    if (after.parliament.government?.id !== second.id && GOVERNING.includes(after.parliament.government?.status)) break;
  }
  const after = store.getState();
  assert.ok(after.parliament.government.id !== second.id && GOVERNING.includes(after.parliament.government.status), `Anche la seconda caduta porta a un nuovo governo in poche settimane.\n  ${seen.join('\n  ')}`);
  assert.ok(weeks <= 6, `La seconda crisi si chiude in ${weeks + 1} settimane.`);
}

// A fall after months of legislature (the weeks of the game before the crisis do not leave the formation stuck).
{
  const late = await scenario('tardi', 10);
  assert.ok(late.resolved?.governing && late.resolved.week <= 12, `Anche una caduta a legislatura avviata si chiude (${JSON.stringify(late.resolved)}).\n  ${late.log.join('\n  ')}`);
}
// The calendar keeps two rounds 180 days apart: with a vote held a short time ago the Chambers are not dissolved into a vote months away, the consultations go on.
{
  const held = await scenario('appena-votato', 0, 14);
  assert.ok(held.phases.has('consultazioni'), 'Le consultazioni si aprono.');
  assert.ok(held.waitMax <= CALENDAR_LIMIT, `Dopo lo scioglimento si vota entro ${CALENDAR_LIMIT} giorni (massimo osservato ${held.waitMax}).\n  ${held.log.join('\n  ')}`);
  assert.ok(held.longest <= 9, `Con un voto appena tenuto il paese non resta ${held.longest} settimane senza governo.\n  ${held.log.join('\n  ')}`);
}
console.log(`Formazione del governo: caduta → ${[...base.phases].join(' → ')}; nuovo governo alla settimana ${base.resolved.week}, massimo ${base.longest} settimane senza governo; seconda caduta e caduta ripetuta risolte.`);
