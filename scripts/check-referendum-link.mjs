// Una raccolta di firme per referendum aperta dalla pagina Iniziative non si ferma al deposito: va collegata a una legge in vigore e diventa la procedura abrogativa vera (Cassazione, Corte, campagna, voto, effetti),
// anche dopo salvataggio e ricaricamento. Non si duplica e non si collega due volte.
import assert from 'node:assert/strict';
import { startCareer, playWeek } from './lib/long-run.mjs';
const { store, db, decide } = await startCareer({ seed: 'referendum-link', level: 'deputato', fast: true });
const state = () => store.getState();
state().parliament = { ...state().parliament, statutes: [{ id: 'statuto-scuola', lawId: 'l1', number: 1, title: 'Fondo per le scuole di montagna', summary: 'Un fondo.', area: 'scuola', instrument: 'investimento', kind: 'ddl', origin: 'La maggioranza', approvedAt: '2026-03-01', status: 'vigente', policy: { area: 'scuola', instrument: 'investimento', intensity: 2 }, amendments: [] }] };
state().game.resources = { ...state().game.resources, funds: 60000, politicalCapital: 30 };
const ini = store.startInitiative({ title: 'Abrogare il fondo per le scuole di montagna', area: 'scuola', articles: [], kind: 'referendum' });
assert.equal(ini.kind, 'referendum');
assert.throws(() => store.linkReferendumCollection(ini.id, { statuteId: 'non-esiste' }), /Scegli la legge/);
assert.throws(() => store.linkReferendumCollection('iniziativa-che-non-c-e', { statuteId: 'statuto-scuola' }), /non è una raccolta/);
const popular = store.startInitiative({ title: 'Una legge popolare', area: 'sanita', articles: ['Art. 1 — Un presidio di quartiere in ogni città.'] });
assert.throws(() => store.linkReferendumCollection(popular.id, { statuteId: 'statuto-scuola' }), /non è una raccolta di firme per un referendum/, 'Una iniziativa legislativa popolare non è un referendum.');
const ref = store.linkReferendumCollection(ini.id, { statuteId: 'statuto-scuola' });
assert.equal(ref.initiativeId, ini.id); assert.equal(ref.phase, 'raccolta'); assert.equal(ref.kind, 'abrogativo');
assert.throws(() => store.linkReferendumCollection(ini.id, { statuteId: 'statuto-scuola' }), /già collegata/, 'Non si collega due volte.');
assert.equal(store.referendums().filter(item => item.initiativeId === ini.id).length, 1, 'Un solo referendum per raccolta.');
// the collection deposits: the referendum goes to the Cassazione and on
state().game.initiatives = state().game.initiatives.map(item => item.id === ini.id ? { ...item, status: 'depositata', verification: { valid: 520000, share: 0.93 }, signatures: { ...item.signatures, total: 560000 } } : item);
for (let week = 0; week < 2; week++) playWeek({ store, db, decide });
let current = store.referendums().find(item => item.id === ref.id);
assert.ok(['cassazione', 'corte', 'campagna'].includes(current.phase), `Dopo il deposito la richiesta va avanti (${current.phase}).`);
// saved, closed and reloaded: the procedure is the same, not duplicated
const saved = JSON.parse(store.exportSave()); store.loadGame(saved);
assert.equal(store.referendums().filter(item => item.initiativeId === ini.id).length, 1, 'Dopo il ricaricamento un solo referendum.');
assert.equal(store.referendums().find(item => item.id === ref.id).phase, current.phase, 'Stessa fase dopo il ricaricamento.');
// a failed collection closes its referendum
const bad = store.startInitiative({ title: 'Altro referendum', area: 'scuola', articles: [], kind: 'referendum' });
state().parliament = { ...state().parliament, statutes: [...state().parliament.statutes, { id: 'statuto-due', lawId: 'l2', number: 2, title: 'Fondo per i trasporti scolastici', summary: 'Un fondo.', area: 'trasporti', instrument: 'investimento', kind: 'ddl', origin: 'La maggioranza', approvedAt: '2026-03-02', status: 'vigente', policy: { area: 'trasporti', instrument: 'investimento', intensity: 2 }, amendments: [] }] };
const second = store.linkReferendumCollection(bad.id, { statuteId: 'statuto-due' });
store.withdrawInitiative(bad.id);
for (let week = 0; week < 2; week++) playWeek({ store, db, decide });
const closed = store.referendums().find(item => item.id === second.id);
assert.ok(closed && ['fallito', 'ritirato'].includes(closed.status), `Una raccolta ritirata chiude il referendum collegato (${closed?.status}).`);
console.log('Referendum da raccolta firme verificato: collegamento a una legge in vigore, non doppio, deposito → Cassazione, salvataggio e ricaricamento, raccolta ritirata → procedura chiusa, una iniziativa popolare non è un referendum.');
