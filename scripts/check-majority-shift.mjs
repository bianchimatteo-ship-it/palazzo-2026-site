// An external supporter that withdraws its support takes its seats out of the numbers: if a Chamber is left without a majority, the Government goes to the verifica at once (it used to stay «in office»
// with 91 seats out of 200 — an invariant violation found by the long run, delta/regionale, week 234). With enough seats left it stays in office.
import assert from 'node:assert/strict';
import { majorityShift } from '../src/core/parliament-engine.js';

const group = (groupId, simulatedSeats) => ({ groupId, simulatedSeats, officialName: groupId, independent: false });
const build = ({ coalition, support }) => ({
  chambers: { camera: { groups: [group('a', 230), group('b', 60), group('c', 110)] }, senato: { groups: [group('a', coalition), group('b', support), group('c', 200 - coalition - support)] } },
  government: { id: 'g1', name: 'Governo di prova', status: 'active', coalitionGroupIds: ['a'], supportingGroupIds: ['b'], ministers: [], partners: {}, stability: 60 },
  history: [], player: null
});

const thin = majorityShift(build({ coalition: 91, support: 11 }), '2031-04-21');
assert.equal(thin.government.supportingGroupIds.length, 0, 'Il sostegno esterno è ritirato.');
assert.equal(thin.government.status, 'crisis', 'Senza il sostegno il Senato ha 91 seggi su 200: il governo va alla verifica.');

const solid = majorityShift(build({ coalition: 110, support: 11 }), '2031-04-21');
assert.equal(solid.government.supportingGroupIds.length, 0, 'Il sostegno è ritirato anche con una maggioranza larga.');
assert.equal(solid.government.status, 'active', 'Con 110 seggi su 200 il governo resta in carica.');
console.log('Ritiro del sostegno esterno verificato: senza i numeri il governo va in crisi subito, con i numeri resta in carica.');
