// The live votes of the assemblies of the territory (and the national ones): the vote offered on Home is the one of the player's own assembly — the Camera or the Senato, a city council, a provincial or regional
// council, the European Parliament — decided by the game, held in the last two weeks and not followed yet; never one still to come, never one already followed or too old, never the giunta (it has no Aula);
// its key is stable (`local:institution|act`), the position left halfway is offered back, and what the Aula shows is exactly the totals of the vote (the seats add up to the groups, nothing is recomputed).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const { liveVoteOffer } = await import(`../src/ui/game-mode.js${v}`);
const { localAula, seatsSvg } = await import(`../src/ui/aula-view.js${v}`);
const { ASSEMBLIES, boardAt } = await import(`../src/core/aula-script.js${v}`);

const group = (id, seats, side) => ({ id, label: `Gruppo ${id}`, seats, side });
const act = (id, extra = {}) => ({ id, title: `Atto ${id}`, stage: 'approvato', closedAt: '2028-05-08', votes: [{ organ: 'consiglio', passed: true, playerChoice: 'favorevole', byGroup: [{ groupId: 'A', yesVotes: 9, noVotes: 1, abstainVotes: 0 }, { groupId: 'B', yesVotes: 2, noVotes: 6, abstainVotes: 1 }] }], ...extra });
const inst = (kind, extra = {}) => ({ id: `${kind}-1`, kind, name: kind === 'comune' ? 'Siena' : kind === 'provincia' ? 'Provincia di Siena' : kind === 'regione' ? 'Toscana' : 'Europa', status: 'active', playerGroupId: 'A', groups: [group('A', 10, 'maggioranza'), group('B', 9, 'opposizione')], acts: [act('a1')], ...extra });
const state = (institutions, flags = {}, today = '2028-05-10') => ({ game: { flags }, clock: { currentDate: today }, parliament: null, local: { institutions } });

for (const [kind, label] of [['comune', 'Consiglio comunale'], ['provincia', 'Consiglio provinciale'], ['regione', 'Consiglio regionale'], ['europa', 'Parlamento europeo']]) {
  const offer = liveVoteOffer(state([inst(kind)]));
  assert.ok(offer, `${kind}: la Home propone la votazione.`);
  assert.equal(offer.kind, 'locale'); assert.equal(offer.id, `local:${kind}-1|a1`, 'Identificativo stabile'); assert.equal(offer.institution, label); assert.equal(offer.label, 'Atto a1');
  assert.deepEqual(liveVoteOffer(state([inst(kind)])), offer, 'Lo stesso stato dà la stessa offerta.');
  assert.equal(liveVoteOffer(state([inst(kind)], { aulaSeen: [offer.id] })), null, `${kind}: seguita una volta non si ripropone.`);
  assert.deepEqual(liveVoteOffer(state([inst(kind)], { aulaProgress: { voteId: offer.id, shown: 7, total: 19 } })).resume, { shown: 7, total: 19 }, `${kind}: la posizione lasciata a metà si riprende.`);
  // the Aula of the territory: the seats are exactly the groups, the totals are those of the vote
  const aula = localAula(inst(kind), act('a1'));
  assert.ok(aula, `${kind}: i dati per entrare in Aula ci sono.`);
  assert.equal(aula.seats.length, 19); assert.equal(aula.script.assembly, { comune: 'comune', provincia: 'provincia', regione: 'regione', europa: 'europeo' }[kind]);
  assert.equal(aula.script.kindLabel, ASSEMBLIES[aula.script.assembly].label, `${kind}: la denominazione è quella dell’istituzione.`);
  const board = boardAt(aula.script, aula.choices, aula.script.order.length);
  assert.deepEqual([board.yes, board.against, board.abstain], [11, 7, 1], `${kind}: a fine voto i numeri sono quelli del voto deciso (11 sì, 7 no, 1 astenuto).`);
  const half = boardAt(aula.script, aula.choices, 9);
  assert.ok(half.yes + half.against + half.abstain <= 9 && half.yes <= 11, `${kind}: a metà il conteggio è parziale e mai oltre il totale.`);
  // the drawing: every seat, with its whole circle, is inside the frame (a small council has big seats near the edge: they used to be cut)
  const svg = seatsSvg(aula);
  const [vx, vy, vw, vh] = svg.match(/viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/).slice(1).map(Number);
  const circles = [...svg.matchAll(/<circle[^>]* cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].map(match => match.slice(1).map(Number));
  assert.equal(circles.length, 19, `${kind}: tutti i seggi sono disegnati.`);
  assert.ok(circles.every(([cx, cy, r]) => cx - r >= vx && cx + r <= vx + vw && cy - r >= vy && cy + r <= vy + vh), `${kind}: ogni seggio sta interamente nel riquadro (nessun taglio a destra, a sinistra, in alto o in basso).`);
  const again = localAula(inst(kind), act('a1'));
  assert.deepEqual(again.script.order, aula.script.order, `${kind}: lo stesso voto si rivede nello stesso ordine (nessun ricalcolo, nessun sorteggio nuovo).`);
}
assert.ok(ASSEMBLIES.provincia.noun === 'Il Consiglio provinciale', 'Il consiglio provinciale ha la sua denominazione.');
// what is never offered
assert.equal(liveVoteOffer(state([inst('comune')], {}, '2028-05-07')), null, 'Una votazione non ancora tenuta non si apre.');
assert.equal(liveVoteOffer(state([inst('comune')], {}, '2028-06-30')), null, 'Dopo due settimane è storia: non è più «in corso».');
assert.equal(liveVoteOffer(state([inst('comune', { acts: [act('g', { votes: [{ organ: 'giunta', passed: true, byGroup: [{ groupId: 'A', yesVotes: 3 }] }] })] })])), null, 'La giunta non vota in un’Aula.');
assert.equal(liveVoteOffer(state([inst('comune', { status: 'closed' })])), null, 'Un’istituzione chiusa non offre votazioni.');
assert.equal(liveVoteOffer(state([inst('comune', { acts: [act('x', { votes: [] })] })])), null, 'Un atto senza voto dei gruppi non ha nulla da mostrare.');
// the national chamber of the player comes first, when there is one
console.log('Votazioni live delle assemblee verificate: Camera/Senato (nel test Aula) e consiglio comunale, provinciale, regionale e Parlamento europeo: offerta in Home solo per il voto in corso, chiave stabile, ripresa, mai prima né dopo, giunta esclusa, totali identici al voto e ordine invariato.');
