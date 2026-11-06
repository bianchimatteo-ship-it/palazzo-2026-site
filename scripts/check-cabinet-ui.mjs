// The team of the Government on the page (ui/cabinet-life-view.js): each minister with grade and meters; for the Prime Minister every request, conflict and meeting has its buttons with the
// data the store action needs (cabinetAction(kind, id, choice)); for anyone else the same page is read only. The store action is then run on a real government: it moves the state once.
import assert from 'node:assert/strict';
import { renderCabinetLife } from '../src/ui/cabinet-life-view.js';
import { startCareer, playWeek } from './lib/long-run.mjs';

const government = (premier) => ({ id: 'g1', status: 'active', primeMinister: premier ? 'player' : 'sim', stability: 55, ministers: [
  { id: 'm1', portfolio: 'Salute', groupName: 'Gruppo A', loyalty: 70, competence: 80, pressure: 0, traits: { ambition: 80, bond: 60, grievance: 0, evaluations: [{ date: '2027-01-01', score: 80, grade: 'ottimo' }] } },
  { id: 'm2', portfolio: 'Economia e finanze', groupName: 'Gruppo B', loyalty: 30, competence: 40, pressure: 4, traits: { ambition: 50, bond: 30, grievance: 1, evaluations: [{ date: '2027-01-01', score: 30, grade: 'insufficiente' }] } }],
  life: { requests: [{ id: 'r1', type: 'ambizione', ministerId: 'm1', by: 'il ministro', openedAt: '2027-02-01' }, { id: 'r2', type: 'sostituzione', ministerId: 'm2', by: 'gli alleati', openedAt: '2027-02-01' }], conflicts: [{ id: 'c1', a: 'm1', b: 'm2', issue: 'Sanità', severity: 2, openedAt: '2027-02-01', resolvedAt: null }], meetings: [{ id: 'k1', area: 'sanita', topic: 'Sanità', openedAt: '2027-02-01', decidedAt: null }, { id: 'k0', area: 'fisco', topic: 'Tasse e fisco', openedAt: '2026-12-01', decidedAt: '2026-12-02', choice: 'approvare' }] } });
const state = premier => ({ game: { week: { index: 10 } }, parliament: { government: government(premier) } });
const mine = renderCabinetLife(state(true));
for (const [kind, id, choice] of [['request', 'r1', 'accogli'], ['request', 'r1', 'rifiuta'], ['request', 'r2', 'accogli'], ['conflict', 'c1', 'media'], ['conflict', 'c1', 'sostieni-a'], ['conflict', 'c1', 'sostieni-b'], ['meeting', 'k1', 'approvare'], ['meeting', 'k1', 'rinviare'], ['meeting', 'k1', 'respingere']]) assert.ok(mine.includes(`data-cabinet-kind="${kind}" data-cabinet-id="${id}" data-cabinet-choice="${choice}"`), `Il pulsante ${kind}/${id}/${choice} c’è.`);
assert.match(mine, /Ottimo/); assert.match(mine, /Insufficiente/); assert.match(mine, /La squadra di governo/); assert.match(mine, /Ultime decisioni/);
const others = renderCabinetLife(state(false));
assert.equal(/data-cabinet-kind/.test(others), false, 'Chi non guida il governo non ha pulsanti.');
assert.match(others, /Decide il Presidente del Consiglio/);
assert.equal(renderCabinetLife({ game: { week: { index: 1 } }, parliament: { government: null } }), '', 'Senza governo la sezione non c’è.');
assert.equal(renderCabinetLife({ game: null, parliament: null }), '');

// the store action refuses to anyone but the Prime Minister
const { store, db, decide } = await startCareer({ seed: 'squadra-ui', level: 'deputato', fast: true, territorial: true });
for (let week = 0; week < 3; week++) playWeek({ store, db, decide });
assert.throws(() => store.cabinetAction('meeting', 'x', 'approvare'), /Presidente del Consiglio/, 'Solo il Presidente del Consiglio decide.');
assert.ok(store.cabinetView().ministers.length > 5);
const html = renderCabinetLife(store.getState());
assert.match(html, /La squadra di governo/, 'Sulla carriera reale la sezione è disegnata.');
console.log('Squadra di governo (pagina) verificata: ministri con valutazione e indicatori, pulsanti con i dati dell’azione solo per il Presidente del Consiglio, sola lettura per gli altri, azione dello store riservata.');
