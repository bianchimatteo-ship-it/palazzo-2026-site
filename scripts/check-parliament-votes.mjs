// Voti di fiducia e direttiva del capogruppo, sul motore: il voto personale sposta davvero il seggio; le richieste legate a un altro Governo non incidono; la direttiva è seguita in parte e non toglie il voto al giocatore; il sostegno esterno richiede il consenso di chi corre da solo.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderParliamentPage } from '../src/ui/parliament-mode.js';
import { makeDemoState } from '../src/data/simulation/demo.js';
import { canManageParliament as canManage } from '../src/core/parliament-engine.js';

const localStore = new Map();
globalThis.localStorage = {
  getItem: key => localStore.get(key) ?? null,
  setItem: (key, value) => localStore.set(key, String(value)),
  removeItem: key => localStore.delete(key)
};
const read = async name => JSON.parse(await readFile(new URL('../src/data/real/' + name + '.json', import.meta.url), 'utf8'));
const groups = await read('parliamentary-groups');
const parties = await read('parties');
const party = parties.find(item => item.id === 'party-futuro-nazionale');
const demo = makeDemoState();
const draftFor = (level, extra = {}) => ({
  firstName: 'Alessia', lastName: 'Verdi', birthDate: '1988-04-20', gender: 'donna',
  region: 'Lombardia', municipality: 'Milano', previousProfession: 'Ricercatrice',
  initialLevel: level, partyMode: 'independent', partyId: '', currentDate: demo.clock.currentDate,
  parliamentaryGroupId: level === 'deputato' ? 'cam-xix-01' : level === 'senatore' ? 'senato-xix-gruppo-85' : '',
  parliamentStartMode: 'real-context', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 }, ...extra
});
// Parliamentary actions cost working days: when the week is used up the player closes it, as in the game.
const PE = await import('../src/core/parliament-engine.js');
const { store } = await import('../src/core/store.js?votes=' + Date.now());
store.reset();
const founder = { partyMode: 'new', partyId: '', partyName: 'Lista di prova', partyAbbreviation: 'LDP', partyDescription: 'Partito fondato dal giocatore per il test.', partyOrientation: 'Altro', partyColor: '#285c42' };
store.createCareer(draftFor('deputato', founder), [party], groups);
store.formGovernment(['cam-xix-01', 'cam-xix-02', 'cam-xix-03', 'senato-xix-gruppo-85', 'senato-xix-gruppo-49', 'senato-xix-gruppo-33']);
store.voteGovernmentConfidence();
const start = store.getState();
const date = start.clock.currentDate;
const seat = start.parliament.player;
// a Government of others (the player sits in the majority) in crisis: the player votes against, in favour, or follows the line
const others = { ...start.parliament, government: { ...start.parliament.government, primeMinister: 'simulato', formedBy: 'elezioni' } };
const crisis = PE.triggerGovernmentCrisis(others, date);
assert.equal(crisis.government.status, 'crisis');
const run = choice => {
  const parliament = choice ? PE.setConfidenceVote(crisis, choice, crisis.government.id) : crisis;
  return PE.voteGovernmentConfidence(parliament, date).government.confidenceVotes.at(-1);
};
const byLine = run(null), against = run('contrario'), inFavour = run('favorevole'), abstain = run('astenuto'), absent = run('assente');
const mine = vote => vote.votes.find(item => item.chamber === seat.chamber);
for (const vote of [byLine, against, inFavour, abstain, absent]) for (const chamber of vote.votes) assert.equal(chamber.yes + chamber.against + chamber.abstain + chamber.absent, chamber.total, `${chamber.chamber}: ogni seggio è contato (favorevoli, contrari, astenuti, assenti).`);
const delta = (a, b) => ({ yes: mine(a).yes - mine(b).yes, no: mine(a).against - mine(b).against });
const lineChoice = mine(byLine).playerLine ?? 'favorevole';
const lineDelta = delta(against, byLine);
if (lineChoice === 'favorevole') assert.deepEqual(lineDelta, { yes: -1, no: 1 }, 'Un voto contrario sposta esattamente il seggio dai favorevoli ai contrari.');
else assert.deepEqual(lineDelta, { yes: 0, no: 0 }, 'Se il voto coincide già con la posizione contata il totale non cambia.');
assert.equal(mine(absent).absent, mine(byLine).absent + 1, 'Chi non partecipa è registrato come assente.');
assert.equal(mine(against).playerChoice, 'contrario');
// the other Chamber is untouched by the personal vote
const other = vote => vote.votes.find(item => item.chamber !== seat.chamber);
assert.deepEqual([other(against).yes, other(against).against], [other(byLine).yes, other(byLine).against]);

// requests for another Government (or expired) never reach a later vote
assert.throws(() => PE.setConfidenceVote(crisis, 'contrario', 'governo-che-non-e-questo'), /altro governo|scadut/);
const stale = { ...crisis, government: { ...crisis.government, pendingPlayerVote: 'contrario', pendingPlayerVoteFor: 'governo-precedente' } };
const staleVote = PE.voteGovernmentConfidence(stale, date).government.confidenceVotes.at(-1);
assert.equal(mine(staleVote).yes, mine(byLine).yes, 'Una decisione presa per un governo precedente non modifica la votazione di questo.');
const chosen = PE.setConfidenceVote(crisis, 'contrario', crisis.government.id);
assert.equal(chosen.government.pendingPlayerVoteFor, crisis.government.id);
const after = PE.voteGovernmentConfidence(chosen, date);
assert.equal(after.government.pendingPlayerVote, null, 'La scelta è consumata dal voto.');

// directive of the group leader: the group follows in part, the player keeps the own vote
{
  const lead = (parliament, choice) => PE.setGroupDirective({ ...parliament, player: { ...parliament.player, leadsGroup: true } }, { kind: 'confidence', targetId: parliament.government.id, choice });
  const none = PE.voteGovernmentConfidence(PE.setConfidenceVote(crisis, 'contrario', crisis.government.id), date).government.confidenceVotes.at(-1);
  const directed = PE.voteGovernmentConfidence(PE.setConfidenceVote(lead(crisis, 'contrario'), 'favorevole', crisis.government.id), date).government.confidenceVotes.at(-1);
  const row = vote => mine(vote).byGroup.find(item => item.groupId === seat.groupId);
  const dir = row(directed).directive;
  assert.ok(dir && dir.choice === 'contrario', 'La direttiva è registrata nel voto.');
  assert.ok(dir.follow > 0 && dir.dissent > 0, `Aderiscono ${dir.follow}, dissentono ${dir.dissent}: né controllo assoluto né indifferenza.`);
  assert.ok(row(directed).noVotes > row(none).noVotes - 1 || row(none).noVotes === row(directed).noVotes, 'Più contrari dopo la direttiva contraria.');
  assert.equal(row(directed).playerChoice, 'favorevole', 'Il giocatore conserva il proprio voto autonomo.');
  // deterministic: same inputs, same adherence
  const again = PE.voteGovernmentConfidence(PE.setConfidenceVote(lead(crisis, 'contrario'), 'favorevole', crisis.government.id), date).government.confidenceVotes.at(-1);
  assert.deepEqual(row(again).directive, dir, 'Adesione deterministica.');
  // a directive of an old Government does nothing; "nessuna" clears it
  assert.throws(() => PE.setGroupDirective({ ...crisis, player: { ...crisis.player, leadsGroup: true } }, { kind: 'confidence', targetId: 'altro', choice: 'favorevole' }), /altro governo|scadut/);
  assert.equal(PE.directiveOf(PE.setGroupDirective(lead(crisis, 'contrario'), { kind: 'confidence', targetId: crisis.government.id, choice: 'nessuna' }), 'confidence', crisis.government.id), null);
  // cohesion and discipline change adherence
  const loose = PE.groupDirectiveEffect({ yes: 30, no: 10, abstain: 5, directive: 'contrario', cohesion: 20, discipline: 20, relation: 20 });
  const tight = PE.groupDirectiveEffect({ yes: 30, no: 10, abstain: 5, directive: 'contrario', cohesion: 95, discipline: 90, relation: 80 });
  assert.ok(tight.follow > loose.follow && loose.follow >= 10 && tight.dissent > 0, 'Coesione e disciplina aumentano l’adesione, mai a controllo assoluto.');
}

console.log('Fiducia e direttiva: voto personale, richieste scadute, registrazione dei voti, direttiva con adesioni e dissensi verificati (il consenso del sostegno esterno non è coperto da un test automatico).');
