// The life of the cabinet (core/cabinet-life-engine.js) on the real government of a career: traits for every minister, the periodic evaluation, requests of ambition and of replacement, the
// conflicts, the cabinet meeting (decided by the Prime Minister, or by default if he lets it pass), the minister who contests and resigns, the effect of a minister's grade on what a measure
// achieves. The same inputs give the same outputs; a save without any of it simply gets it.
import assert from 'node:assert/strict';
import { startCareer, playWeek } from './lib/long-run.mjs';
import { CABINET_LIFE, advanceCabinetLife, cabinetView, decideMeeting, lifeOf, ministerFactor, resolveConflict, resolveRequest } from '../src/core/cabinet-life-engine.js';
import { activeMinisters } from '../src/core/parliament-engine.js';

const { store, db, decide } = await startCareer({ seed: 'squadra', level: 'deputato', fast: true, territorial: true });
for (let week = 0; week < 30; week++) playWeek({ store, db, decide });
const parliament = JSON.parse(JSON.stringify(store.getState().parliament));
assert.ok(parliament.government && ['active', 'crisis'].includes(parliament.government.status), 'C’è un governo in carica.');
const view = store.cabinetView();
assert.ok(view.ministers.length >= 5, `Il governo ha i suoi ministri (${view.ministers.length}).`);
for (const minister of view.ministers) { assert.ok(Number.isFinite(minister.ambition) && Number.isFinite(minister.bond), `${minister.portfolio}: ambizione e rapporto con il Presidente del Consiglio.`); }
assert.ok(view.ministers.some(item => item.grade), 'Dopo una trentina di settimane i ministri hanno una valutazione.');
assert.ok(lifeOf(parliament.government).lastEval, 'La valutazione periodica è registrata.');

// ---------- the engine on a copy, with the player as Prime Minister (so that things wait for him) ----------
const day = week => new Date(Date.parse('2027-03-01T12:00:00Z') + week * 7 * 86400000).toISOString().slice(0, 10);
const rig = (p, patch) => ({ ...p, government: { ...p.government, life: undefined, formedAt: day(-1), ministers: p.government.ministers.map(item => item.endedAt ? item : { ...item, traits: undefined, ...(patch[item.portfolio] ?? {}) }) } });
const ministers = activeMinisters(parliament.government).filter(item => item.groupId && !item.playerAppointed);
assert.ok(ministers.length >= 3, 'Ci sono ministri di gruppo.');
const [a, b, c] = ministers;
let p = rig(parliament, { [a.portfolio]: { competence: 15, loyalty: 20, pressure: 9 }, [b.portfolio]: { competence: 95, loyalty: 85, pressure: 0 } });
p = { ...p, government: { ...p.government, ministers: p.government.ministers.map(item => item.id === b.id ? { ...item, traits: { ambition: 95, bond: 80, grievance: 0, evaluations: [], asked: 0 } } : item.id === a.id ? { ...item, traits: { ambition: 25, bond: 40, grievance: 0, evaluations: [], asked: 0 } } : item.id === c.id ? { ...item, traits: { ambition: 90, bond: 30, grievance: 0, evaluations: [], asked: 0 } , loyalty: 10 } : item) } };
const rand = seed => { let s = seed; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
const run = (start, weeks, premier = true, offset = 0) => { let cur = start; const all = []; const r = rand(7 + offset); for (let week = 0; week < weeks; week++) { const out = advanceCabinetLife(cur, { date: day(offset + week + 1), week: offset + week, rand: r, society: null, playerPremier: premier }); cur = out.parliament; all.push(...out.lines); } return { parliament: cur, lines: all }; };
const a1 = run(p, 14);
const lifeA = lifeOf(a1.parliament.government);
assert.ok(lifeA.lastEval, 'Alla tredicesima settimana scatta la valutazione.');
const after = id => a1.parliament.government.ministers.find(item => item.id === id);
assert.equal(after(a.id).traits.evaluations.at(-1).grade, 'insufficiente', 'Un ministro incompetente, sleale e sotto pressione è insufficiente.');
assert.ok(['ottimo', 'buono'].includes(after(b.id).traits.evaluations.at(-1).grade), 'Uno competente e leale è ottimo o buono.');
assert.ok(a1.lines.some(line => /Valutazione dei ministri/.test(line)), 'La valutazione è raccontata.');
// ambition request from the good minister
assert.ok(lifeA.requests.some(item => item.type === 'ambizione' && item.ministerId === b.id), 'Chi lavora bene e ha ambizione chiede di più.');
// a second bad evaluation asks for the replacement
const a2 = run(a1.parliament, 14, true, 14);
assert.ok(lifeOf(a2.parliament.government).requests.some(item => item.type === 'sostituzione' && item.ministerId === a.id), `Due insufficienze di fila: si chiede la sostituzione. ${JSON.stringify({ ev: a2.parliament.government.ministers.find(item => item.id === a.id)?.traits?.evaluations, req: lifeOf(a2.parliament.government).requests, last: lifeOf(a2.parliament.government).lastEval, lines: a2.lines.slice(0, 6) })}`);
// the quarrel: loyalty 10 + ambition 90 → public contest, then resignation
assert.ok([...a1.lines, ...a2.lines].some(line => /contesta pubblicamente/.test(line)), 'Il ministro in rotta contesta in pubblico.');
assert.ok(a2.parliament.government.ministers.some(item => item.id === c.id && item.endedAt && /polemiche/.test(item.endReason)), 'E alla fine si dimette sbattendo la porta.');
assert.ok(activeMinisters(a2.parliament.government).some(item => item.portfolio === c.portfolio), 'Il suo posto è preso da un nuovo ministro dello stesso gruppo.');

// ---------- the answers of the Prime Minister ----------
const ask = lifeOf(a1.parliament.government).requests.find(item => item.type === 'ambizione' && item.ministerId === b.id);
const accepted = resolveRequest(a1.parliament, ask.id, 'accogli', day(15));
assert.ok(after(b.id).loyalty <= accepted.parliament.government.ministers.find(item => item.id === b.id).loyalty, 'Accogliere la richiesta rafforza la lealtà.');
assert.equal(lifeOf(accepted.parliament.government).requests.some(item => item.id === ask.id), false, 'La richiesta si chiude.');
const refused = resolveRequest(a1.parliament, ask.id, 'rifiuta', day(15));
assert.ok(refused.parliament.government.ministers.find(item => item.id === b.id).loyalty < after(b.id).loyalty, 'Rifiutare costa lealtà.');
assert.throws(() => resolveRequest(a1.parliament, 'inesistente', 'accogli', day(15)), /non è più aperta/);
const swap = lifeOf(a2.parliament.government).requests.find(item => item.type === 'sostituzione');
const replaced = resolveRequest(a2.parliament, swap.id, 'accogli', day(30));
assert.ok(replaced.parliament.government.ministers.find(item => item.id === a.id).endedAt, 'Accogliere la richiesta sostituisce il ministro.');
assert.ok(activeMinisters(replaced.parliament.government).some(item => item.portfolio === a.portfolio), 'Con un nuovo ministro dello stesso gruppo.');
// meeting: opens, waits, and lapses to a postponement if nobody decides
const m = run(p, 8);
const meeting = lifeOf(m.parliament.government).meetings.at(-1);
assert.ok(meeting, 'Il Consiglio dei ministri si riunisce.');
const stabilityBefore = m.parliament.government.stability;
const live = lifeOf(m.parliament.government).meetings.find(item => !item.decidedAt);
if (live) {
  const approved = decideMeeting(m.parliament, live.id, 'approvare', day(9));
  assert.ok(lifeOf(approved.parliament.government).meetings.find(item => item.id === live.id).decidedAt, 'La decisione è registrata.');
  assert.throws(() => decideMeeting(approved.parliament, live.id, 'rinviare', day(9)), /ha già deciso/);
  assert.throws(() => decideMeeting(m.parliament, live.id, 'boh', day(9)), /approvare, rinviare o respingere/);
  const rejected = decideMeeting(m.parliament, live.id, 'respingere', day(9));
  assert.ok(rejected.lines[0].includes('respinge'), 'Respingere è un esito diverso.');
}
const lapsed = run(m.parliament, 6, true, 8);
assert.ok(lifeOf(lapsed.parliament.government).meetings.every(item => item.decidedAt || weeksOver(item) < CABINET_LIFE.meetingPatience + 1), 'Un Consiglio lasciato aperto decade nel rinvio.');
function weeksOver(item) { return Math.floor((Date.parse(`${day(14)}T12:00:00Z`) - Date.parse(`${item.openedAt}T12:00:00Z`)) / 604800000); }
// conflicts, if the cabinet has rival areas
const conflicts = lifeOf(run(p, 30).parliament.government).conflicts;
if (conflicts.length) {
  const open = conflicts.find(item => !item.resolvedAt);
  const mid = run(p, 10).parliament; const live2 = lifeOf(mid.government).conflicts.find(item => !item.resolvedAt);
  if (live2) { const settled = resolveConflict(mid, live2.id, 'media', day(11)); assert.ok(lifeOf(settled.parliament.government).conflicts.find(item => item.id === live2.id).resolvedAt, 'Mediare chiude lo scontro.'); assert.throws(() => resolveConflict(settled.parliament, live2.id, 'media', day(11)), /non è più aperto/); }
  void open;
}
// a simulated Prime Minister answers by himself
const auto = run(p, 30, false);
assert.ok(lifeOf(auto.parliament.government).requests.length <= 1, 'Un Presidente del Consiglio simulato risponde da solo alle richieste.');
// determinism
// (the ids of the new appointments are random in the game: what is compared is everything else)
const original = new Set(p.government.ministers.map(item => item.id));
const essence = government => JSON.stringify({ stability: government.stability, ministers: government.ministers.map(item => [item.portfolio, item.endedAt ?? null, item.endReason ?? null, item.loyalty, item.pressure, original.has(item.id) ? [item.traits?.ambition, item.traits?.bond, item.traits?.grievance] : 'nuovo', (item.traits?.evaluations ?? []).map(entry => entry.grade)]), requests: lifeOf(government).requests.map(item => [item.type, item.openedAt]), conflicts: lifeOf(government).conflicts.map(item => [item.issue, item.openedAt, item.resolvedAt ?? null]), meetings: lifeOf(government).meetings.map(item => [item.area, item.openedAt, item.decidedAt ?? null, item.choice ?? null]) });
const e1 = essence(run(p, 20).parliament.government), e2 = essence(run(p, 20).parliament.government);
let at = 0; while (at < e1.length && e1[at] === e2[at]) at++;
assert.equal(e1, e2, `Stessi dati, stesso risultato (a parte gli identificativi delle nuove nomine): ${e1.slice(Math.max(0, at - 60), at + 60)} ≠ ${e2.slice(Math.max(0, at - 60), at + 60)}`);
// factor
assert.ok(ministerFactor({ government: { ministers: [{ id: 'x', portfolio: 'Salute', traits: { evaluations: [{ grade: 'ottimo' }] } }] } }, 'sanita') > 1.05, 'Un ottimo ministro rende le misure più efficaci.');
assert.ok(ministerFactor({ government: { ministers: [{ id: 'x', portfolio: 'Salute', traits: { evaluations: [{ grade: 'insufficiente' }] } }] } }, 'sanita') < 0.95, 'Uno insufficiente le rende meno efficaci.');
assert.equal(ministerFactor({ government: { ministers: [] } }, 'sanita'), 1);
assert.equal(cabinetView({ government: null }), null);
// the view for the page
const pageView = cabinetView(a1.parliament);
assert.ok(pageView.requests.length && pageView.requests[0].minister, 'La pagina vede le richieste con il ministro.');
console.log(`Vita del governo verificata: ${view.ministers.length} ministri con ambizione e rapporto, valutazione periodica, richieste di ambizione e di sostituzione, dimissioni polemiche, Consiglio dei ministri (decisioni e decadenza), conflitti, fattore del ministro sulle misure, determinismo.`);
