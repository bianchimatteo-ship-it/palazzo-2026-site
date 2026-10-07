// The members of the simulated Chambers as people (seat-roster, store.changeMember, the weekly step): each one a persistent person of the simulation with a state of his own (where he was
// elected, attachment, standing with the player, history); group, party and list change separately; defection, the Misto (alone and when a group falls below the minimum), resignation and loss
// of the seat with the vacancy and the replacement, the return; every change moves the person in the roster and the seat in the counts of the groups together, so the majority, the opposition
// and the Government follow; saves, old saves, determinism and the immutable real data.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { startCareer, fingerprint } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const R = await import(`../src/core/seat-roster.js${v}`);
const P = await import(`../src/core/parliament-engine.js${v}`);
const { checkInvariants } = await import(`../src/core/invariants.js${v}`);
const { chamberRoster } = await import(`../src/core/hemicycle.js${v}`);
const { advanceDays } = await import(`../src/core/time.js${v}`);
const { LEGISLATURE_RULES } = await import(`../src/core/legislature-engine.js${v}`);
const real = await import(`../src/data/repositories/real-data.js${v}`);
const hashOf = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const CHAMBERS = ['camera', 'senato'];

const run = await startCareer({ seed: 'parlamento-dinamico', level: 'deputato' });
const store = run.store;
await real.loadRealDatabase();
await real.loadRealCollections(['politicians', 'parliamentaryGroups', 'parties']);
const db = real.realDatabase;
const realBefore = hashOf({ politicians: db.politicians, groups: db.parliamentaryGroups, parties: db.parties });
const state = () => store.getState();
const chamber = name => state().parliament.chambers[name];
const person = id => state().dataset.politicians.find(item => item.id === id);
const seatsOf = (name, groupId) => chamber(name).groups.find(group => group.groupId === groupId).simulatedSeats;
const total = name => chamber(name).groups.reduce((sum, group) => sum + group.simulatedSeats, 0);
const full = name => name === 'camera' ? 400 : 200;
const vac = () => CHAMBERS.reduce((sum, name) => sum + R.vacanciesOf(chamber(name).roster).length, 0);
const waiting = personId => CHAMBERS.some(name => R.vacanciesOf(chamber(name).roster).some(item => item.formerPersonId === personId));
const sound = (label, expectVacant = null) => {
  const result = checkInvariants(state(), run.context);
  assert.ok(result.ok, `${label}: stato coerente: ${result.issues.slice(0, 3).map(item => `[${item.code}] ${item.message}`).join('; ')}`);
  for (const name of CHAMBERS) {
    const ch = chamber(name);
    const people = R.rosterPeople(ch.roster);
    assert.equal(new Set(people).size, people.length, `${label}: nessuno siede due volte (${name}).`);
    assert.ok(R.rosterInSync(ch.roster, ch.groups.map(group => ({ id: group.groupId, seats: group.simulatedSeats })), state().parliament.player?.chamber === name ? { personId: state().career.playerId, groupId: state().parliament.player.groupId } : null), `${label}: i seggi seguono i gruppi (${name}).`);
    for (const group of ch.groups) {
      assert.equal(R.rosterSeats(ch.roster).filter(seat => seat.groupId === group.groupId).length, group.simulatedSeats, `${label}: ${group.officialName}: un seggio, una persona.`);
      for (const part of (group.components ?? []).filter(item => item.listId)) assert.equal(R.rosterSeats(ch.roster).filter(seat => seat.groupId === group.groupId && seat.listId === part.listId).length, part.seats, `${label}: ${group.officialName}: la componente ${part.listId} ha i seggi di chi ci siede.`);
    }
    const accounted = total(name) + R.vacanciesOf(ch.roster).length;
    assert.ok(name === 'camera' ? accounted === 400 : accounted >= 200 && accounted <= 210, `${label}: seggi assegnati e vacanti (${name}: ${accounted}).`);
    for (const id of people) { const who = person(id); assert.ok(who && who.source === 'simulation' && R.inOffice(who.member), `${label}: ${id} è una persona della simulazione in carica.`); }
  }
  if (expectVacant !== null) assert.equal(CHAMBERS.reduce((sum, name) => sum + R.vacanciesOf(chamber(name).roster).length, 0), expectVacant, `${label}: seggi vacanti.`);
};

// ---------- 1. the Chambers born from a vote of the game: every seat a person, every person a member with his own state ----------
let guard = 0;
const goes = (days, delegate = true) => { const target = advanceDays(state().clock.currentDate, days); const result = store.advanceToDate(target, { delegate }); assert.equal(result.reason, 'data'); };
goes(26 * 7 * 3);
while ((state().parliament?.legislature?.reference !== 'simulation' || state().parliament.government?.status !== 'active') && guard++ < 40) goes(14);
assert.equal(state().parliament.legislature.reference, 'simulation', 'Le Camere nascono da un voto della partita.');
assert.equal(state().parliament.government?.status, 'active', 'Un governo in carica.');
const date0 = state().clock.currentDate;
store.advance(7);
for (const name of CHAMBERS) {
  const ch = chamber(name);
  assert.equal(total(name), full(name), `${name}: tutti i seggi assegnati.`);
  for (const seat of R.rosterSeats(ch.roster)) {
    const who = person(seat.personId);
    assert.ok(who, `${seat.personId}: persona nel registro.`);
    if (seat.origin === 'player') continue;
    assert.equal(who.source, 'simulation');
    assert.equal(who.origin, 'seggio');
    const member = who.member;
    assert.ok(member && R.inOffice(member) && member.since >= ch.roster.date, `${seat.personId}: stato del parlamentare.`);
    assert.ok(Number.isFinite(member.loyalty) && member.loyalty >= 40 && member.loyalty <= 90 && Number.isFinite(member.relation) && member.relation >= 0 && member.relation <= 100);
    if (!member.history) assert.ok(JSON.stringify(member).length < 120 && !member.electedFor && !member.assembly, 'Lo stato di chi non si è mai mosso è piccolo: non ripete quello che è uguale per tutti.');
  }
}
sound('Camere nate dal voto');
const members = name => R.rosterSeats(chamber(name).roster).filter(seat => seat.origin !== 'player');
const groupOf = (name, id) => chamber(name).groups.find(group => group.groupId === id);
const majorityIds = () => new Set([...state().parliament.government.coalitionGroupIds, ...state().parliament.government.supportingGroupIds]);
const backing = name => chamber(name).groups.filter(group => majorityIds().has(group.groupId)).reduce((sum, group) => sum + group.simulatedSeats, 0);
const opposition = name => total(name) - backing(name);

// ---------- 2. a defection to another group: person, roster, counts, majority and opposition move together ----------
const governing = chamber('camera').groups.filter(group => majorityIds().has(group.groupId) && !group.component && group.simulatedSeats >= 20)[0];
const oppositional = chamber('camera').groups.filter(group => !majorityIds().has(group.groupId) && !group.component && group.simulatedSeats >= 20)[0];
assert.ok(governing && oppositional, 'Un gruppo di maggioranza e uno di opposizione.');
const mover = members('camera').find(seat => seat.groupId === governing.groupId && R.inOffice(person(seat.personId).member));
const moverBefore = person(mover.personId);
const [backingBefore, oppositionBefore, fromSeats, toSeats] = [backing('camera'), opposition('camera'), seatsOf('camera', governing.groupId), seatsOf('camera', oppositional.groupId)];
const historyBefore = state().parliament.history.length;
store.changeMember('camera', { type: 'defezione', kind: 'group', personId: mover.personId, to: { groupId: oppositional.groupId, partyId: oppositional.partyId } });
let moved = person(mover.personId);
assert.deepEqual(R.seatOf(chamber('camera').roster, mover.personId), { groupId: oppositional.groupId, partyId: oppositional.partyId });
assert.equal(moved.partyId, oppositional.partyId, 'Il partito della persona segue.');
assert.equal(moved.id, moverBefore.id, 'Stessa identità.');
assert.deepEqual(moved.member.electedFor, { groupId: governing.groupId, partyId: governing.partyId }, 'Ricorda con chi era stato eletto.');
assert.equal(moved.member.history.at(-1).type, 'defezione-group');
assert.ok(moved.member.since >= date0 && moved.member.relation !== undefined);
assert.equal(seatsOf('camera', governing.groupId), fromSeats - 1);
assert.equal(seatsOf('camera', oppositional.groupId), toSeats + 1);
assert.equal(total('camera'), 400, 'Il totale dei seggi non cambia.');
assert.equal(backing('camera'), backingBefore - 1, 'La maggioranza perde un seggio.');
assert.equal(opposition('camera'), oppositionBefore + 1, 'L’opposizione ne guadagna uno.');
assert.ok(state().parliament.history.length > historyBefore && state().parliament.history.some(entry => entry.type === 'membro-gruppo' && entry.details.personId === mover.personId));
assert.ok((state().world?.events ?? []).some(event => event.title === 'Cambio di gruppo in Parlamento'), 'La cronaca lo riporta.');
const drawn = chamberRoster(state().parliament, 'camera', { people: new Map(state().dataset.politicians.map(item => [item.id, item])), db: { parliamentaryGroups: [] }, politicians: [] });
assert.ok(drawn.sitting && drawn.seats.some(seat => seat.person?.id === mover.personId && seat.groupId === oppositional.groupId), 'L’emiciclo lo disegna nel nuovo gruppo.');
sound('cambio di gruppo');
// What he is: a person of the simulation, never a real one, and the real data are as they were.
assert.equal(hashOf({ politicians: db.politicians, groups: db.parliamentaryGroups, parties: db.parties }), realBefore, 'I dati reali non sono stati toccati.');

// ---------- 3. the Misto keeping the party, out of the party but not the group: three separate things ----------
const keeper = members('camera').find(seat => seat.groupId === oppositional.groupId && seat.personId !== mover.personId && person(seat.personId).partyId);
const keeperParty = person(keeper.personId).partyId;
const toMisto = chamber('camera').groups.find(group => group.independent);
store.changeMember('camera', { type: 'defezione', kind: 'misto', personId: keeper.personId, to: { groupId: toMisto?.groupId ?? null, partyId: keeperParty } });
const mistoGroup = chamber('camera').groups.find(group => group.independent);
assert.ok(mistoGroup && mistoGroup.component && mistoGroup.partyId === null && state().parliament.relations[mistoGroup.groupId], 'Il Misto degli indipendenti c’è, con la sua relazione.');
assert.deepEqual(R.seatOf(chamber('camera').roster, keeper.personId), { groupId: mistoGroup.groupId, partyId: keeperParty }, 'Nel Misto ma nel suo partito.');
assert.equal(person(keeper.personId).partyId, keeperParty);
assert.equal(seatsOf('camera', mistoGroup.groupId) >= 1, true);
sound('passaggio al Misto');
const outOfParty = members('camera').find(seat => seat.groupId === oppositional.groupId && ![mover.personId, keeper.personId].includes(seat.personId) && person(seat.personId).partyId);
const groupBefore = seatsOf('camera', oppositional.groupId);
store.changeMember('camera', { type: 'defezione', kind: 'party', personId: outOfParty.personId, to: { groupId: oppositional.groupId, partyId: null } });
assert.deepEqual(R.seatOf(chamber('camera').roster, outOfParty.personId), { groupId: oppositional.groupId, partyId: null }, 'Fuori dal partito ma nello stesso gruppo.');
assert.equal(person(outOfParty.personId).partyId, null);
assert.equal(seatsOf('camera', oppositional.groupId), groupBefore, 'Il gruppo non cambia.');
sound('fuori dal partito');
// Component only: a member of the territorial lists of the Misto passes to another of its lists, in the same group and with the same party (none).
{
  const territorial = chamber('camera').groups.find(group => (group.components ?? []).filter(item => item.listId).length >= 2);
  const lists = territorial.components.filter(item => item.listId);
  const [source, target] = [lists.find(item => item.seats > 1) ?? lists[0], lists.find(item => item.listId !== (lists.find(other => other.seats > 1) ?? lists[0]).listId)];
  const listed = members('camera').find(seat => seat.groupId === territorial.groupId && seat.listId === source.listId);
  const before = Object.fromEntries(lists.map(item => [item.listId, item.seats]));
  store.changeMember('camera', { type: 'defezione', kind: 'component', personId: listed.personId, to: { groupId: territorial.groupId, partyId: null, listId: target.listId } });
  assert.deepEqual(R.seatOf(chamber('camera').roster, listed.personId), { groupId: territorial.groupId, partyId: null, listId: target.listId }, 'Stesso gruppo, stesso partito, un’altra componente.');
  const after = chamber('camera').groups.find(group => group.groupId === territorial.groupId);
  assert.equal(after.simulatedSeats, territorial.simulatedSeats, 'Il gruppo non cambia.');
  assert.equal(after.components.find(item => item.listId === source.listId).seats, before[source.listId] - 1);
  assert.equal(after.components.find(item => item.listId === target.listId).seats, before[target.listId] + 1);
  assert.equal(person(listed.personId).member.history.at(-1).type, 'defezione-component');
  assert.equal(person(listed.personId).partyId ?? null, null);
  sound('cambio di componente');
  // (and when a member of a list leaves, the list gives the seat up; the next of the list takes it back)
  const vacBefore = vac();
  store.changeMember('camera', { type: 'perdita', reason: 'dimissioni', personId: listed.personId });
  assert.equal(chamber('camera').groups.find(group => group.groupId === territorial.groupId).components.find(item => item.listId === target.listId).seats, before[target.listId]);
  sound('componente senza un membro', vacBefore + 1);
  const vacantList = R.vacanciesOf(chamber('camera').roster).find(item => item.formerPersonId === listed.personId);
  assert.equal(vacantList.listId, target.listId, 'Il seggio vacante è della sua componente.');
  goes(21);
  assert.ok(!R.vacanciesOf(chamber('camera').roster).some(item => item.id === vacantList.id), 'Il subentro avviene.');
  sound('componente dopo il subentro');
}
// A new sync of the roster keeps the members who sit under another party than their group's (they are not sent away).
{
  const roster = chamber('camera').roster;
  const specs = chamber('camera').groups.map(group => { const spec = { id: group.groupId, label: group.officialName, partyId: group.partyId ?? null, seats: group.simulatedSeats, parts: (group.components ?? []).filter(item => item.listId).map(item => ({ partyId: null, listId: item.listId, label: item.label, seats: item.seats })) }; return { ...spec, parts: R.partsWithGuests(roster, spec) }; });
  const again = R.syncRoster({ assembly: roster.assembly, kind: 'camera', label: roster.label, groups: specs.map(spec => spec.id === oppositional.groupId ? { ...spec, seats: spec.seats + 1 } : spec), previous: roster, date: roster.date });
  for (const guest of [keeper.personId, outOfParty.personId]) assert.deepEqual(R.seatOf(again.roster, guest), R.seatOf(roster, guest), 'Chi siede sotto un altro partito resta dov’è.');
  assert.ok(!again.released.includes(keeper.personId) && !again.released.includes(outOfParty.personId));
}
// Refused: the player, a real politician, somebody who is not seated, a change that changes nothing.
assert.throws(() => store.changeMember('camera', { type: 'defezione', kind: 'group', personId: state().career.playerId, to: { groupId: oppositional.groupId, partyId: null } }), /non è possibile/);
assert.throws(() => store.changeMember('camera', { type: 'defezione', kind: 'group', personId: db.politicians.find(item => item.chamber === 'camera').id, to: { groupId: oppositional.groupId, partyId: null } }), /non è possibile/);
assert.throws(() => store.changeMember('camera', { type: 'defezione', kind: 'group', personId: 'nessuno', to: { groupId: oppositional.groupId, partyId: null } }), /non è possibile/);
assert.throws(() => store.changeMember('camera', { type: 'defezione', kind: 'group', personId: mover.personId, to: { groupId: oppositional.groupId, partyId: oppositional.partyId } }), /non è possibile/, 'Dove siede già.');

// ---------- 4. the return where he was elected ----------
const countBack = seatsOf('camera', governing.groupId);
const backingPre = backing('camera'), oppositionPre = opposition('camera');
store.changeMember('camera', { type: 'ritorno', personId: mover.personId, to: { ...person(mover.personId).member.electedFor } });
assert.deepEqual(R.seatOf(chamber('camera').roster, mover.personId), { groupId: governing.groupId, partyId: governing.partyId }, 'Torna dove era stato eletto.');
assert.equal(seatsOf('camera', governing.groupId), countBack + 1);
assert.equal(person(mover.personId).member.history.map(item => item.type).join(','), 'defezione-group,ritorno', 'La sua storia.');
assert.equal(backing('camera'), backingPre + 1, 'La maggioranza riprende il suo seggio.');
assert.equal(opposition('camera'), oppositionPre - 1, 'L’opposizione lo perde.');
sound('ritorno');

// ---------- 5. a seat left empty: the vacancy, the count that is not padded, the next of the list ----------
const leaver = members('senato').find(seat => groupOf('senato', seat.groupId).simulatedSeats >= 20);
const leaverGroup = groupOf('senato', leaver.groupId);
const seatsBefore = leaverGroup.simulatedSeats;
const vacSenatoBefore = R.vacanciesOf(chamber('senato').roster).length;
const leaverBefore = person(leaver.personId);
store.changeMember('senato', { type: 'perdita', reason: 'dimissioni', personId: leaver.personId });
assert.equal(R.seatOf(chamber('senato').roster, leaver.personId), null, 'Non siede più.');
assert.equal(seatsOf('senato', leaver.groupId), seatsBefore - 1, 'Il gruppo ha un seggio occupato in meno: il conteggio non è gonfiato.');
assert.equal(total('senato'), 199);
assert.equal(R.vacanciesOf(chamber('senato').roster).length, vacSenatoBefore + 1);
const vacancy = R.vacanciesOf(chamber('senato').roster).find(item => item.formerPersonId === leaver.personId);
assert.equal(vacancy.groupId, leaver.groupId);
assert.equal(vacancy.formerPersonId, leaver.personId);
assert.equal(vacancy.fillAt, advanceDays(state().clock.currentDate, LEGISLATURE_RULES.members.replaceAfterDays));
assert.equal(person(leaver.personId).member.status, 'dimesso', 'Resta una persona nel registro, dimessa.');
assert.equal(person(leaver.personId).id, leaverBefore.id);
assert.ok(person(leaver.personId).member.until);
assert.equal(person(leaver.personId).member.history.at(-1).type, 'dimissioni');
assert.ok(!R.inOffice(person(leaver.personId).member));
sound('seggio vacante');
assert.throws(() => store.changeMember('senato', { type: 'perdita', reason: 'dimissioni', personId: leaver.personId }), /non è possibile/, 'Chi non siede non si dimette di nuovo.');
goes(7);
assert.ok(waiting(leaver.personId), 'Il subentro non è immediato.');
goes(14);
assert.ok(!waiting(leaver.personId), 'Il subentro avviene.');
const replacementSeat = R.rosterSeats(chamber('senato').roster).find(seat => seat.groupId === leaver.groupId && person(seat.personId).member?.history?.[0]?.type === 'subentro');
assert.ok(replacementSeat, 'Un nuovo eletto subentra nel gruppo.');
const replacement = person(replacementSeat.personId);
assert.equal(replacement.source, 'simulation');
assert.notEqual(replacement.id, leaver.personId, 'Non è la stessa persona.');
assert.equal(R.seatOf(chamber('senato').roster, leaver.personId), null, 'Il dimesso non è tornato.');
assert.equal(state().parliament.history.filter(entry => entry.type === 'membro-subentro' && entry.details.formerPersonId === leaver.personId).length, 1);
assert.equal(person(leaver.personId)?.member.status, 'dimesso', 'Il dimesso resta nella storia.');
sound('subentro');
// The other ways to lose a seat, and the seat of a group that is not there any more has nobody waiting.
for (const [reason, status] of [['decadenza', 'decaduto'], ['incompatibilita', 'decaduto'], ['decesso', 'deceduto']]) {
  const target = members('camera').find(seat => seat.groupId === governing.groupId);
  const vacHere = vac();
  store.changeMember('camera', { type: 'perdita', reason, personId: target.personId });
  assert.equal(person(target.personId).member.status, status, reason);
  sound(`perdita (${reason})`, vacHere + 1);
  goes(21);
  assert.ok(!waiting(target.personId), `Il seggio lasciato per ${reason} è stato preso dal successivo.`);
  sound(`subentro dopo ${reason}`);
}

// ---------- 6. the Misto when it is foreseen: a group that falls below the minimum sits there as a component ----------
const minimum = LEGISLATURE_RULES.groups.cameraWaiver;
const small = chamber('camera').groups.filter(group => !group.component && !group.independent && group.partyId && group.simulatedSeats >= minimum && group.simulatedSeats <= minimum + 4).sort((a, b) => a.simulatedSeats - b.simulatedSeats)[0];
assert.ok(small, 'Un gruppo piccolo.');
const smallId = small.groupId, smallLabel = small.officialName;
const wasInMajority = majorityIds().has(smallId);
while (groupOf('camera', smallId).simulatedSeats >= minimum) {
  assert.equal(groupOf('camera', smallId).component, false, 'Finché ha il minimo è un gruppo.');
  const seat = members('camera').find(item => item.groupId === smallId);
  store.changeMember('camera', { type: 'defezione', kind: 'group', personId: seat.personId, to: { groupId: governing.groupId, partyId: governing.partyId } });
}
const folded = groupOf('camera', smallId);
assert.equal(folded.component, true, 'Sotto il minimo siede nel Misto come componente.');
assert.equal(folded.officialName, `Misto – ${smallLabel}`);
assert.equal(folded.simulatedSeats, minimum - 1);
assert.equal(R.rosterSeats(chamber('camera').roster).filter(seat => seat.groupId === smallId).length, minimum - 1, 'Le sue persone sono al loro posto.');
assert.equal(majorityIds().has(smallId), wasInMajority, 'Il suo posto in maggioranza (o all’opposizione) non cambia.');
assert.ok(state().parliament.history.some(entry => entry.type === 'membro-gruppo-misto' && entry.details.groupId === smallId));
sound('gruppo sotto il minimo');

// ---------- 7. the numbers fall under a Government in office: the verifica ----------
assert.equal(state().parliament.government.status, 'active');
let guardMoves = 0;
const heavy = () => chamber('camera').groups.filter(group => majorityIds().has(group.groupId)).sort((a, b) => b.simulatedSeats - a.simulatedSeats)[0];
while (state().parliament.government.status === 'active' && guardMoves++ < 120) {
  const margin = backing('camera') - (Math.floor(total('camera') / 2) + 1);
  const seat = members('camera').find(item => item.groupId === heavy().groupId);
  store.changeMember('camera', { type: 'defezione', kind: 'misto', personId: seat.personId, to: { groupId: chamber('camera').groups.find(group => group.independent).groupId, partyId: person(seat.personId).partyId } });
  if (margin > 0) assert.equal(state().parliament.government.status === 'active', backing('camera') >= Math.floor(total('camera') / 2) + 1 && backing('senato') >= Math.floor(total('senato') / 2) + 1, 'Il governo resta in carica finché ha i numeri.');
}
assert.equal(state().parliament.government.status, 'crisis', 'Senza maggioranza il governo va alla verifica.');
assert.ok(backing('camera') < Math.floor(total('camera') / 2) + 1, 'Perché alla Camera non ha più i numeri.');
assert.ok(state().parliament.history.some(entry => entry.type === 'crisi-spontanea' && /non ha più i numeri/.test(entry.text)));
sound('crisi per i numeri');

// ---------- 8. weeks go by: the draws change members, nothing breaks, nobody sits twice ----------
const seen = new Map();
for (let piece = 0; piece < 6; piece++) {
  goes(26 * 7);
  for (const entry of state().parliament.history.filter(item => item.type.startsWith('membro-'))) seen.set(entry.id, entry.type);
  sound(`tre anni di settimane (${piece + 1}/6)`);
}
const kinds = new Set(seen.values());
assert.ok(seen.size >= 8 && kinds.size >= 3, `Nei tre anni ci sono cambiamenti di più tipi (${seen.size}: ${[...kinds].join(', ')}).`);
for (const name of CHAMBERS) for (const seat of members(name)) assert.ok(R.inOffice(person(seat.personId).member));
// Who was a member and left stays a person of the registry with his history (the latest ones).
const gone = state().dataset.politicians.filter(item => item.origin === 'seggio' && item.member && !R.inOffice(item.member));
for (const who of gone) assert.ok(who.source === 'simulation' && who.member.history.length >= 1 && who.member.until);

// ---------- 9. save and load: the same members, the same seats, the same vacancies ----------
const lastWeek = store.getState().clock.currentDate;
const vacant = () => CHAMBERS.reduce((sum, name) => sum + R.vacanciesOf(chamber(name).roster).length, 0);
const vacantBefore = vacant();
const lostId = members('camera').find(seat => seat.groupId === heavy().groupId).personId;
store.changeMember('camera', { type: 'perdita', reason: 'dimissioni', personId: lostId });
const snapshot = JSON.parse(store.exportSave());
assert.equal(R.vacanciesOf(snapshot.parliament.chambers.camera.roster).length + R.vacanciesOf(snapshot.parliament.chambers.senato.roster).length, vacantBefore + 1, 'Il seggio vacante è nel salvataggio.');
const saved = { people: state().dataset.politicians.filter(item => item.member).map(item => [item.id, item.partyId ?? null, JSON.stringify(item.member)]), rosters: JSON.stringify(CHAMBERS.map(name => chamber(name).roster)), groups: JSON.stringify(CHAMBERS.map(name => chamber(name).groups)) };
store.loadGame(JSON.parse(store.exportSave()));
assert.equal(state().clock.currentDate, lastWeek);
assert.deepEqual(state().dataset.politicians.filter(item => item.member).map(item => [item.id, item.partyId ?? null, JSON.stringify(item.member)]), saved.people, 'Gli stessi parlamentari, con la loro storia.');
assert.equal(JSON.stringify(CHAMBERS.map(name => chamber(name).roster)), saved.rosters, 'Gli stessi seggi.');
assert.equal(JSON.stringify(CHAMBERS.map(name => chamber(name).groups)), saved.groups, 'Gli stessi gruppi.');
sound('dopo il caricamento', vacantBefore + 1);
goes(21);
assert.ok(!CHAMBERS.some(name => R.vacanciesOf(chamber(name).roster).some(item => item.formerPersonId === lostId)), 'Il subentro avviene anche dopo il caricamento.');
sound('subentro dopo il caricamento');

// ---------- 10. a game saved before the members: the persons get their state at the next week ----------
const old = JSON.parse(store.exportSave());
for (const item of old.dataset.politicians) delete item.member;
store.loadGame(old);
assert.ok(state().dataset.politicians.filter(item => item.origin === 'seggio').every(item => !item.member));
store.advance(7);
sound('vecchio salvataggio');
assert.ok(R.rosterPeople(chamber('camera').roster).every(id => person(id).member), 'Ognuno ha il suo stato.');
assert.equal(hashOf({ politicians: db.politicians, groups: db.parliamentaryGroups, parties: db.parties }), realBefore, 'I dati reali non sono stati toccati.');

// ---------- 11. the same game, the same changes ----------
const play = async () => { const other = await startCareer({ seed: 'parlamento-dinamico', level: 'deputato' }); other.store.advanceToDate('2029-06-30', { delegate: true }); return other.store.getState(); };
const first = fingerprint(await play());
const second = fingerprint(await play());
assert.equal(first, second, 'Stessa partita, stessi cambiamenti.');

console.log('Parlamento dinamico verificato: ogni seggio simulato ha una persona con il proprio stato (eletto con chi, legame, rapporto con il giocatore, storia); cambio di gruppo con il suo partito, passaggio al Misto restando nel partito e uscita dal partito restando nel gruppo come cose separate; ritorno dove era stato eletto; dimissioni, decadenza, incompatibilità e decesso con il seggio vacante (conteggio non gonfiato) e il subentro del successivo della lista; gruppo sotto il minimo nel Misto come componente; maggioranza e opposizione che seguono i seggi e un governo che senza numeri va alla verifica; nessuno siede due volte, persone reali mai coinvolte; salvataggio, vecchi salvataggi e determinismo.');
