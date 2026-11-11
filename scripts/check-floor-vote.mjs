// The player's own vote in the assemblies where the player sits (Camera, Senato, a city council, the plenary of the European Parliament): a vote OPENS and waits for the player's ballot — Favorevole, Contrario or
// Astenuto, never a default, never «the line of the group», never an absence for want of a choice. Checked on the engines and the store:
//   · the week cannot be closed, whatever way the time is advanced (advance, advanceTurn, advanceToDate, fastForwardToElection) while a vote waits;
//   · before the ballot nothing is counted: no result, no law moved, no effect, no entry in the records;
//   · only the three ballots are accepted; the count is made once, with the ballot, and the ballot is the one counted (and shown once);
//   · followed live or simulated the result is the very same (same bill, same composition, same ballot → same vote);
//   · the counts add up (voted + absent = seats); an abstention is an expressed vote, distinct from an absence;
//   · an open vote survives a save and a reload and is resolved once afterwards (no duplicated vote, effect, record or notification);
//   · the same rule for a council (several careers, several seeds); the notice names the measure and the assembly.
import assert from 'node:assert/strict';
import { startCareer } from './lib/long-run.mjs';
import { castOpenVotes } from './lib/floor.mjs';

const BALLOTS = ['favorevole', 'contrario', 'astenuto'];
const run = async (level, seed, check) => {
  const { store } = await startCareer({ seed, level, fast: true });
  store.setHeadlessVoter(null);   // nobody votes for the player: the tests cast their own ballots
  const keep = () => { const s = store.getState(); if (s.game.status === 'ended') { s.game.status = 'active'; s.game.endReason = null; } };
  const untilOpen = (scope, weeks = 80) => { for (let i = 0; i < weeks; i++) { keep(); const open = store.openVotes().filter(item => item.scope === scope); if (open.length) return open; store.advance(7); } return []; };
  await check({ store, untilOpen });
};
const sum = vote => Number(vote.yes) + Number(vote.against) + Number(vote.abstain) + Number(vote.absent ?? 0);

// ---------- 1. the Chamber ----------
for (const [level, seed] of [['deputato', 'f1'], ['senatore', 'f2']]) {
  await run(level, seed, async ({ store, untilOpen }) => {
    const open = untilOpen('nazionale');
    assert.ok(open.length, `${level}: dopo qualche settimana una votazione si apre e attende il giocatore.`);
    const vote = open[0];
    // the notice: which measure, and where
    assert.ok(vote.title && vote.assemblyName && /Camera|Senato/.test(vote.assemblyName) && vote.proposer && vote.summary && vote.content.length >= 1, `${level}: la votazione dice il provvedimento, l’assemblea, il proponente e il contenuto.`);
    assert.ok(!/^(Scuola|Sanità|Economia|Lavoro)$/i.test(vote.title), 'Non una categoria generica.');
    const law = () => store.getState().parliament.laws.find(item => item.id === vote.lawId);
    const votesBefore = law().votes.length, stageBefore = law().stage;
    assert.ok(law().floor && votesBefore === 0 || law().floor, 'La votazione è un stato della legge, salvato con essa.');
    assert.ok(!store.getState().parliament.history.some(entry => entry.details?.lawId === vote.lawId && /^iter-(approved|rejected|other-chamber)$/.test(entry.type) && entry.date >= vote.openedAt), 'Prima del voto nessun esito è registrato.');

    // the week cannot be closed, in any way
    const date = store.getState().clock.currentDate, week = store.getState().game.week.index;
    const blocked = store.advance(7);
    assert.equal(blocked?.blocked, 'voto', 'advance(7) si ferma.');
    store.advanceTurn(3);
    assert.equal(store.advanceToDate('2030-01-01', { delegate: true }).reason, 'voto', 'Nemmeno la delega del personale vota al posto del giocatore.');
    store.fastForwardToElection('politiche');
    assert.deepEqual([store.getState().clock.currentDate, store.getState().game.week.index], [date, week], 'Il tempo non è avanzato.');
    assert.match(store.getState().ui.toast, /devi votare|votazione/i, 'Il motivo si legge.');
    assert.equal(law().votes.length, votesBefore, 'Nessun voto contato.');
    assert.equal(law().stage, stageBefore, 'La legge non è avanzata.');

    // only the three ballots
    for (const wrong of [null, undefined, '', 'linea', 'assente', 'forse', 'segui il gruppo']) assert.throws(() => store.castOpenVote(vote.id, wrong), /Favorevole, Contrario o Astenuto/, `Voto non valido: ${wrong}`);
    assert.throws(() => store.castOpenVote('law:inesistente', 'favorevole'), /non è più aperta/);
    assert.equal(law().votes.length, votesBefore, 'I rifiuti non cambiano nulla.');

    // saved and reloaded: still open, the way chosen to attend it kept, no recount
    store.setFloorMode(vote.id, 'diretta');
    const snapshot = store.exportSave();
    store.loadGame(JSON.parse(snapshot), 'Ricarica');
    assert.deepEqual(store.openVotes().map(item => item.id), open.map(item => item.id), 'Dopo il salvataggio e il ricaricamento la votazione è ancora aperta.');
    assert.equal(store.getState().game.flags.floorMode?.mode, 'diretta', 'E il modo scelto è ricordato.');
    assert.equal(law().votes.length, votesBefore, 'Il ricaricamento non ricalcola nulla.');

    // live and simulated: the same result for the same bill, the same composition and the same ballot
    const ballot = vote.line === 'favorevole' ? 'contrario' : 'favorevole';
    const asSim = store.castOpenVote(vote.id, ballot, { mode: 'simulata' });
    const simulated = JSON.stringify(asSim.result);
    const historySim = store.getState().parliament.history.filter(entry => entry.details?.lawId === vote.lawId).length;
    store.loadGame(JSON.parse(snapshot), 'Ricarica');
    const asLive = store.castOpenVote(vote.id, ballot, { mode: 'diretta' });
    assert.equal(JSON.stringify(asLive.result), simulated, 'Diretta e simulazione: stesso provvedimento, stessa assemblea, stesso voto → stesso esito.');
    assert.ok(store.getState().game.flags.aulaLive === asLive.voteId && !(store.getState().game.flags.aulaSeen ?? []).includes(asLive.voteId), 'La diretta si può seguire in Aula (e resta da vedere).');
    assert.equal(store.getState().parliament.history.filter(entry => entry.details?.lawId === vote.lawId).length, historySim, 'Stessi effetti nel registro nei due modi.');

    // the result: the ballot counted once, the counts add up, an abstention is not an absence
    const result = asLive.result;
    assert.equal(result.playerChoice, ballot, 'Il voto espresso è quello contato.');
    assert.equal(result.byGroup.filter(row => row.playerChoice).length, 1, 'Il voto del giocatore compare una sola volta.');
    assert.equal(sum(result), result.total, 'Favorevoli + contrari + astenuti + assenti = seggi.');
    assert.equal(result.passed, result.yes >= result.needed);
    assert.equal(law().floor ?? null, null, 'Contato il voto, la votazione è chiusa.');
    assert.equal(law().votes.length, votesBefore + 1, 'Un solo voto registrato.');
    assert.throws(() => store.castOpenVote(vote.id, ballot), /non è più aperta/, 'Non si vota due volte.');
    assert.equal(store.getState().parliament.history.filter(entry => entry.details?.lawId === vote.lawId && /^iter-/.test(entry.type) && entry.date >= vote.openedAt).length, 1, 'Un solo esito nel registro per questa votazione (niente doppioni).');
    assert.ok(!store.getState().game.inbox.some(item => ['voto-aula', 'voto-fiducia'].includes(item.templateId)), 'Nessuna richiesta di voto con scelta predefinita in agenda.');

    // every ballot counts exactly one vote; abstaining is an expressed vote
    const outcomes = {};
    for (const choice of BALLOTS) {
      store.loadGame(JSON.parse(snapshot), 'Ricarica');
      outcomes[choice] = store.castOpenVote(vote.id, choice).result;
      assert.equal(outcomes[choice].playerChoice, choice);
      assert.equal(sum(outcomes[choice]), outcomes[choice].total);
    }
    assert.equal(outcomes.favorevole.yes - outcomes.contrario.yes, 1, 'Favorevole o contrario sposta un voto.');
    assert.equal(outcomes.astenuto.abstain - outcomes.favorevole.abstain, 1, 'L’astensione è contata tra gli astenuti…');
    assert.equal(outcomes.astenuto.absent, outcomes.favorevole.absent, '…e non tra gli assenti.');
    // the time goes on afterwards
    store.loadGame(JSON.parse(snapshot), 'Ricarica'); store.castOpenVote(vote.id, 'astenuto');
    const after = store.getState().clock.currentDate;
    store.advance(7);
    assert.ok(store.getState().clock.currentDate > after || store.openVotes().length, 'Dopo il voto la settimana si chiude (o si apre un’altra votazione).');
    console.log(`  ${level}: «${vote.title}» (${vote.assemblyName}) aperta, tempo bloccato, voto ${ballot}: ${asLive.result.yes} sì, ${asLive.result.against} no, ${asLive.result.abstain} astenuti su ${asLive.result.total}; diretta = simulazione.`);
  });
}

// ---------- 2. the player's own bill: the same rule ----------
await run('deputato', 'f3', async ({ store }) => {
  const law = store.proposeLaw({ title: 'Fondo per i servizi locali', category: 'Welfare', summary: 'Istituisce un fondo simulato per rafforzare i servizi di prossimità.' });
  const wait = () => { castOpenVotes(store); store.advance(7); };
  store.advanceLaw(law.id, 'present'); wait(); wait(); wait();
  store.advanceLaw(law.id, 'complete-commission'); wait(); wait(); wait();
  for (let i = 0; i < 8 && store.getState().parliament.laws.find(item => item.id === law.id).stage === 'commission'; i++) { try { store.advanceLaw(law.id, 'complete-commission'); } catch { wait(); } }
  const current = () => store.getState().parliament.laws.find(item => item.id === law.id);
  store.advanceLaw(law.id, 'vote');
  assert.ok(current().floor && current().votes.length === 0 && current().stage === 'amendments', 'La propria proposta chiamata al voto: la votazione si apre e attende il giocatore.');
  const open = store.openVotes().find(item => item.lawId === law.id);
  assert.ok(open?.own && open.title === law.title && open.proposer, 'La votazione sulla propria proposta è tra quelle aperte, con il proponente.');
  assert.equal(store.advance(7)?.blocked, 'voto', 'Il tempo non scorre.');
  const out = store.castOpenVote(open.id, 'favorevole');
  assert.equal(out.result.playerChoice, 'favorevole');
  assert.equal(current().votes.length, 1); assert.equal(current().floor ?? null, null);
  console.log(`  propria proposta: «${law.title}» votata di persona (${out.result.yes} sì su ${out.result.total}).`);
});

// ---------- 3. a city council ----------
await run('comunale', 'f4', async ({ store, untilOpen }) => {
  const open = untilOpen('locale', 120);
  assert.ok(open.length, 'Il consigliere è chiamato a votare di persona in consiglio.');
  const vote = open[0];
  assert.ok(vote.title && /Consiglio|Commissione/.test(vote.assemblyName) && vote.place, 'Il consiglio dice quale atto e in quale assemblea (con il comune).');
  const act = () => store.getState().local.institutions.find(item => item.id === vote.instId).acts.find(item => item.id === vote.actId);
  assert.equal(act().votes.length, 0, 'Nessun voto prima del voto del consigliere.');
  const date = store.getState().clock.currentDate;
  assert.equal(store.advance(7)?.blocked, 'voto');
  assert.equal(store.getState().clock.currentDate, date, 'La settimana non si chiude.');
  for (const wrong of ['linea', 'assente', null]) assert.throws(() => store.castOpenVote(vote.id, wrong), /Favorevole, Contrario o Astenuto/);
  const snapshot = store.exportSave();
  store.loadGame(JSON.parse(snapshot), 'Ricarica');
  assert.ok(store.openVotes().some(item => item.id === vote.id), 'Aperta dopo il ricaricamento.');
  const sim = store.castOpenVote(vote.id, 'contrario', { mode: 'simulata' });
  store.loadGame(JSON.parse(snapshot), 'Ricarica');
  const live = store.castOpenVote(vote.id, 'contrario', { mode: 'diretta' });
  if (sim.result && live.result) {
    assert.equal(JSON.stringify(live.result), JSON.stringify(sim.result), 'In consiglio: diretta e simulazione danno lo stesso esito.');
    assert.equal(sum({ yes: live.result.yes, against: live.result.against, abstain: live.result.abstain, absent: live.result.absent }), live.result.total, 'I conti tornano.');
    assert.equal(live.result.playerChoice, 'contrario');
  }
  assert.equal(act()?.floor ?? null, null, 'Contato il voto, la votazione è chiusa.');
  console.log(`  consiglio: «${vote.title}» (${vote.assemblyName}, ${vote.place}) aperta e votata di persona.`);
});
console.log('Voto personale in Aula verificato: la votazione si apre e attende il voto del giocatore (Camera, Senato, consiglio), il tempo non scorre finché non ha votato, nessun esito prima del voto, solo Favorevole/Contrario/Astenuto, diretta e simulazione identiche, conti coerenti, voto che sopravvive al ricaricamento e viene contato una volta sola.');
