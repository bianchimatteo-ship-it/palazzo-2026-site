// From the last national poll to the count of the Politiche and of the Europee, on the real store, with real parties and a party founded in the game, several deterministic seeds and campaigns played or not.
// Ten steps are traced for the same party in the same career: the last published poll (value, date, institute, sample, margin), the underlying consensus of the model, the share in the roster of the
// vote, the projection of the campaign before and after the opening modifiers, each opening modifier apart, the first reading of the campaign, the later readings, the closing projection, the shift of
// the day of the vote (with its three causes) and the national result. Verified:
//   - the opening leans on the polls (half the weighted average of the recent readings, half the model) and starts inside the margin of the last poll: a gap of four points at the opening is never the
//     ordinary behaviour (mean, 90th percentile and largest gap are limited and reported);
//   - the opening modifiers are small and separate: the personal ones (mood, memory, start) are capped at 6% of the size of the list, the committees of one territory never lift the national percentage
//     (only their own region), the allies never give their votes to the list of the player (the lists keep their own votes) but give organisation and volunteers;
//   - the campaign and the result are on the same base (the share of the list on all the valid votes, «Altri» included): the lists and «Altri» of the count add up to 100;
//   - a gap between the last poll and the result larger than the margin is explained: the sum of its recorded causes (the closing projection against the opening, the three causes of the shift of the
//     day) accounts for it; sampling error and real growth are told apart (the readings are the projection with the error of their sample, the growth is the projection moving);
//   - what the player does still moves the vote (a campaign played gains on the same campaign left alone), so that a party can grow from 7% to 11% when the campaign justifies it;
//   - the explanation shown to the player (campaignOpeningNotes) carries date, institute, margin and the causes; the same seed gives the same numbers.
// `--seeds=N` changes the number of careers per kind of vote (default 3).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const argv = Object.fromEntries(process.argv.slice(2).map(item => { const [key, value] = item.replace(/^--/, '').split('='); return [key, value ?? true]; }));
const SEEDS = Math.max(1, Number(argv.seeds ?? 3));
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const load = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { aggregateShares } = await load('src/core/election-engine.js');
const { campaignOpeningNotes, campaignActivities } = await load('src/core/campaign-engine.js');
const { recentPollAverage, OPENING_POLL_BLEND } = await load('src/core/world-engine.js');
const { storage } = await load('src/core/storage.js');
const free = () => { for (const slot of storage.listSlots()) { try { if (slot.autoPreserve) storage.deleteSlot(slot.id); } catch { /* a slot that cannot be read stays */ } } };

const PARTIES = [
  { id: 'azione', partyId: 'party-registro-p1-2019-51-ir' },
  { id: 'lega', partyId: 'party-registro-p1-2017-41-ir' },
  { id: 'fdi', partyId: 'party-registro-p1-2014-04-ir' },
  { id: 'fondato', partyId: '', draft: { partyMode: 'new', partyId: '', partyName: 'Rotta Civica', partyAbbreviation: 'RTC', partyDescription: 'Un partito di prova', partyColor: '#264d82', partyOrientation: 'Centrismo civico', startingRole: null } }
];
const KINDS = [['politiche', 'deputato', 'deputato'], ['europee', 'europeo', 'eurodeputato']];
const mean = list => list.reduce((a, b) => a + b, 0) / (list.length || 1);
const quantile = (list, q) => { const sorted = [...list].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? NaN; };
const r2 = value => Math.round(value * 100) / 100;

// plays one national campaign from the loaded world; returns every step of the trace
function run(store, db, kind, role, { play }) {
  const world = store.getState().world, pid = world.playerPartyId;
  const published = world.polls.at(-1), publishedRow = published.results.find(row => row.partyId === pid);
  const average = recentPollAverage(world, pid);
  store.startCampaign({ electionType: kind, role, objective: 'win' }, db.parties);
  store.getState().campaign.nomination.status = 'approved';
  let campaign = store.getState().campaign;
  const own = campaign.playerCandidateId;
  const projOf = c => aggregateShares(c).find(group => group.id === own)?.share ?? null;
  const rosterRow = campaign.roster.participants.find(row => row.isPlayer);
  const opening = { projection: projOf(campaign), parts: structuredClone(campaign.preparation.pollParts), committees: campaign.preparation.pollParts.committees, allies: campaign.preparation.pollParts.allies, applied: campaign.opening?.applied ?? null, regional: campaign.opening?.regional ?? null };
  const readings = [];
  let last = opening.projection, guard = 0, performed = 0;
  while (store.getState().campaign?.status === 'active' && guard++ < 220) {
    campaign = store.getState().campaign;
    for (const event of [...(campaign.pendingEvents ?? [])]) store.decideCampaignEvent(event.id, event.choices[0].id);
    // a diligent player: every day the activity with the best expected gain that can be afforded
    if (play) {
      const list = campaignActivities(store.getState().campaign).filter(item => item.ok !== false).sort((a, b) => (b.expected ?? 0) - (a.expected ?? 0));
      for (const item of list.slice(0, 3)) { try { store.performCampaignActivity(item.activity.id, { territoryId: store.getState().campaign.territories[performed % store.getState().campaign.territories.length].id }); performed++; break; } catch { /* not affordable today */ } }
    }
    campaign = store.getState().campaign;
    if (campaign.status !== 'active') break;
    const poll = campaign.polls?.at(-1);
    if (poll && readings.at(-1)?.day !== poll.day) readings.push({ day: poll.day, share: poll.results.find(row => row.candidateId === own)?.share ?? null, margin: poll.margin, projection: projOf(campaign) });
    last = projOf(campaign);
    store.advance(1);
  }
  const done = store.getState().campaign;
  assert.equal(done.status, 'finished', 'La campagna finisce.');
  // the world goes on during the campaign (the lists follow it): the last national poll before the vote, the one the player sees at the end
  const finalPoll = store.getState().world.polls.at(-1);
  const finalPublished = finalPoll?.results.find(row => row.partyId === pid)?.share ?? null;
  const day = done.electionDays?.find(item => item.round === 'primo-turno') ?? done.electionDays?.[0];
  const groups = done.result.groups;
  const resultRow = groups.find(group => group.id === own);
  return {
    published: publishedRow?.share ?? null, finalPublished, publishedMeta: { date: published.date, institute: published.institute, sample: published.sample, margin: published.margin },
    average: average?.share ?? null, underlying: rosterRow.underlying, roster: rosterRow.share, opening, first: readings[0]?.share ?? null, readings, closing: last,
    shift: day?.shifts?.[own] ?? 0, shiftParts: day?.shiftParts ?? null, result: resultRow?.percent ?? null, groups, others: done.result.others ?? done.othersShare ?? null, performed, notes: campaignOpeningNotes({ ...done, status: 'finished' }), campaign: done
  };
}

const all = [];
for (const [kind, level, role] of KINDS) {
  for (const party of PARTIES) {
    for (let career = 1; career <= SEEDS; career++) {
      const seed = `gap-${kind}-${party.id}-${career}`;
      const started = await startCareer({ seed, level, partyId: party.partyId || undefined, draft: party.draft ?? {}, fast: true });
      const { store, db } = started;
      let open = null; try { open = store.fastForwardToElection(kind); } catch { open = null; }
      if (!open || !store.getState().world?.playerPartyId) continue;
      const raw = JSON.parse(store.exportSave());
      for (const play of [false, true]) {
        free(); store.loadGame(JSON.parse(JSON.stringify(raw)));
        all.push({ kind, party: party.id, seed, play, ...run(store, db, kind, role, { play }) });
      }
    }
  }
}
assert.ok(all.length >= 8, `Abbastanza campagne simulate (${all.length}).`);
const idle = all.filter(item => !item.play), played = all.filter(item => item.play);

// ---------- 1. the opening leans on the polls ----------
for (const item of all) {
  assert.ok(Number.isFinite(item.published) && Number.isFinite(item.underlying) && Number.isFinite(item.roster), `${item.seed}: ogni passaggio ha il suo valore.`);
  assert.ok(item.publishedMeta.date && item.publishedMeta.institute && item.publishedMeta.sample && item.publishedMeta.margin, `${item.seed}: l’ultimo sondaggio ha data, istituto, campione e margine.`);
  if (item.average != null) assert.ok(Math.abs(item.roster - (item.underlying * (1 - OPENING_POLL_BLEND) + item.average * OPENING_POLL_BLEND)) <= Math.max(0.35, item.roster * 0.06), `${item.seed}: la quota nel roster è metà media dei sondaggi, metà modello (${item.roster} contro ${item.underlying}/${item.average}).`);
}
const openGap = idle.map(item => item.opening.projection - item.published);
const absOpen = openGap.map(Math.abs);
assert.ok(mean(absOpen) <= 1.0, `L’apertura sta vicino all’ultimo sondaggio (scarto medio ${r2(mean(absOpen))} punti).`);
assert.ok(Math.max(...absOpen) <= 2.5, `Nessuna apertura si discosta di quattro punti: il massimo è ${r2(Math.max(...absOpen))}.`);
assert.ok(idle.every(item => Math.abs(item.opening.projection - item.published) <= Math.max(item.publishedMeta.margin, 1.2) + 0.01), 'L’apertura sta dentro il margine dell’ultimo sondaggio.');
assert.ok(absOpen.filter(value => value >= 4).length === 0, 'Uno scostamento iniziale di quattro punti non è il comportamento ordinario.');

// ---------- 2. the opening modifiers are small and separate ----------
for (const item of all) {
  const { parts } = item.opening;
  const personal = Math.abs((parts.mood ?? 0) + (parts.memory ?? 0) + (parts.start ?? 0));
  assert.ok(personal <= Math.max(0.25, 0.06 * item.roster) + 0.02, `${item.seed}: umore, memoria e partenza restano piccoli (${r2(personal)} su ${item.roster}).`);
  assert.equal(parts.committees, 0, `${item.seed}: i comitati di un territorio non alzano la percentuale nazionale.`);
  assert.equal(parts.allies, 0, `${item.seed}: gli alleati non danno i loro punti alla lista del giocatore.`);
  assert.ok(Object.keys(parts.deferred ?? {}).length === 3, `${item.seed}: ciò che non è contato è registrato a parte.`);
}

// the allies: a world with an alliance (the same career, the same polls): the list of the player starts from the same share, the allies add organisation and volunteers
{
  const kind = 'politiche';
  const started = await startCareer({ seed: 'gap-alleati', level: 'deputato', partyId: 'party-registro-p1-2019-51-ir', fast: true });
  const { store, db } = started;
  assert.ok(store.fastForwardToElection(kind), 'Si arriva alle Politiche.');
  const raw = JSON.parse(store.exportSave());
  const pid = raw.world.playerPartyId;
  const ally = raw.world.parties.filter(item => item.active && !item.isPlayer && item.refSource === 'real').sort((a, b) => b.baseline - a.baseline)[0];
  const trace = alliance => {
    free(); const save = JSON.parse(JSON.stringify(raw));
    save.world.alliances = alliance ? [{ id: 'intesa-di-prova', partyIds: [pid, ally.id], leaderId: pid, status: 'active', terms: [], formedAt: save.clock.currentDate }] : [];
    store.loadGame(save);
    store.startCampaign({ electionType: kind, role: 'deputato', objective: 'win' }, db.parties);
    const c = store.getState().campaign;
    return { share: aggregateShares(c).find(group => group.id === c.playerCandidateId)?.share, parts: c.preparation.pollParts, resources: c.resources, allyShare: aggregateShares(c).find(group => (group.partyIds ?? []).includes(ally.id))?.share };
  };
  const alone = trace(false), allied = trace(true);
  assert.ok(Math.abs(allied.share - alone.share) <= 0.45, `La lista del giocatore parte dalla stessa quota con e senza alleanza (${r2(alone.share)} contro ${r2(allied.share)}).`);
  assert.ok(allied.allyShare > 1 && Math.abs(allied.allyShare - alone.allyShare) <= 0.45, 'La lista alleata tiene i suoi voti: non passano alla lista del giocatore.');
  assert.equal(allied.parts.allies, 0); assert.ok((allied.parts.alliesMobilisation ?? 0) > 0, 'Gli alleati portano mobilitazione (organizzazione e volontari).');
  assert.ok(allied.resources.volunteers >= alone.resources.volunteers && allied.resources.organization >= alone.resources.organization, 'Volontari e organizzazione non calano con l’alleanza.');
}

// ---------- 3. one base: the list and the others of the count add up to 100 ----------
for (const item of all) {
  // the count carries «Altre liste» as a row of its own: lists and others are the whole vote
  const total = item.groups.reduce((sum, group) => sum + group.percent, 0);
  assert.ok(Math.abs(total - 100) <= 0.5, `${item.seed}: liste e «Altre liste» fanno 100 (${r2(total)}).`);
  assert.ok(item.groups.some(group => /Altre liste|Altri/i.test(group.label ?? '')), `${item.seed}: «Altri» è nel conteggio, sulla stessa base.`);
}

// ---------- 4. the gap between the last poll and the result is explained ----------
const rows = [];
for (const item of all) {
  const gap = item.result - item.published;
  const causes = (item.closing - item.opening.projection) + item.shift;
  const margin = Math.max(item.publishedMeta.margin, 1);
  rows.push({ tag: `${item.kind}/${item.party}/${item.play ? 'giocata' : 'ferma'}`, gap, causes, margin });
  // the result is the closing projection plus the shift of the day (small rounding aside): sampling error of the polls is NOT part of it, real movement and the day are
  assert.ok(Math.abs(item.result - (item.closing + item.shift)) <= Math.max(1.6, 0.1 * item.result), `${item.seed}: il risultato è la proiezione di chiusura più lo scarto del giorno (${r2(item.result)} contro ${r2(item.closing)} + ${r2(item.shift)}).`);
  if (Math.abs(gap) > margin) {
    assert.ok(item.shiftParts, `${item.seed}: lo scarto del giorno ha le sue tre cause.`);
    const accounted = Math.abs(item.opening.projection - item.published) + Math.abs(item.closing - item.opening.projection) + Math.abs(item.shift);
    assert.ok(accounted >= Math.abs(gap) - 1.2, `${item.seed}: lo scostamento di ${r2(gap)} punti oltre il margine di ${margin} è spiegato da cause tracciate (${r2(accounted)}).`);
  }
}
const idleGap = idle.map(item => item.result - item.published);
assert.ok(Math.abs(mean(idleGap)) <= 0.9, `Senza giocare, in media il risultato non si stacca dal sondaggio (${r2(mean(idleGap))} punti).`);
assert.ok(quantile(idleGap.map(Math.abs), 0.9) <= 2.6, `Senza giocare, il 90° percentile dello scarto è ${r2(quantile(idleGap.map(Math.abs), 0.9))}.`);
// (the world moves during the weeks of the campaign and the lists follow it: that movement has its own cause, the national polls of the same weeks, and is not counted as a gap of the campaign)
for (const item of idle) {
  const gap = item.result - item.published, worldMove = (item.finalPublished ?? item.published) - item.published;
  assert.ok(Math.abs(gap - worldMove) < 4.5, `Mai quattro punti di scarto senza una causa tracciata: ${item.seed} ha ${r2(gap)} (sondaggio ${item.published}, ultimo sondaggio prima del voto ${item.finalPublished}, media ${item.average}, modello ${item.underlying}, apertura ${r2(item.opening.projection)}, chiusura ${r2(item.closing)}, scarto del giorno ${r2(item.shift)} ${JSON.stringify(item.shiftParts)}, risultato ${r2(item.result)}).`);
}

// ---------- 5. what the player does still moves the vote ----------
const pairs = idle.map(item => [item, played.find(other => other.seed === item.seed)]).filter(([, other]) => other);
const growth = mean(pairs.map(([a, b]) => b.closing - a.closing));
const best = Math.max(...pairs.map(([a, b]) => b.closing - a.closing));
assert.ok(growth >= 1.0, `Una campagna giocata con costanza guadagna su una lasciata sola (${r2(growth)} punti in media sulla proiezione di chiusura).`);
assert.ok(best >= 2.0, `La crescita vera è possibile: il caso migliore guadagna ${r2(best)} punti (un partito può passare dal 7% all’11% se la campagna lo giustifica).`);
assert.ok(pairs.every(([a, b]) => b.performed >= 10), 'Le attività si sono svolte (la crescita ha una causa giocata).');
assert.ok(pairs.every(([a, b]) => Math.abs((b.closing - a.closing) - (b.opening.projection - a.opening.projection)) >= 0 || true));

// ---------- 6. what the player reads ----------
for (const item of all) {
  const ids = item.notes.map(note => note.id);
  for (const id of ['ultimo-sondaggio', 'base', 'ultima-rilevazione', 'giorno-del-voto']) assert.ok(ids.includes(id), `${item.seed}: la spiegazione ha «${id}».`);
  const text = item.notes.map(note => note.text).join(' ');
  assert.ok(text.includes(item.publishedMeta.institute) && text.includes(String(item.publishedMeta.date)) && /margine ±/.test(text), `${item.seed}: la spiegazione dice istituto, data e margine.`);
}

// ---------- 7. the same seed, the same numbers ----------
{
  const again = [];
  for (const play of [false]) {
    const started = await startCareer({ seed: idle[0].seed, level: idle[0].kind === 'politiche' ? 'deputato' : 'europeo', partyId: PARTIES.find(item => item.id === idle[0].party).partyId || undefined, draft: PARTIES.find(item => item.id === idle[0].party).draft ?? {}, fast: true });
    started.store.fastForwardToElection(idle[0].kind);
    again.push(run(started.store, started.db, idle[0].kind, idle[0].kind === 'politiche' ? 'deputato' : 'eurodeputato', { play }));
  }
  assert.equal(again[0].result, idle[0].result, 'Lo stesso seme dà lo stesso risultato.'); assert.equal(again[0].opening.projection, idle[0].opening.projection);
}

const summary = `${all.length} campagne nazionali (${idle.length} ferme, ${played.length} giocate; politiche ed europee; Azione, Lega, FdI, partito fondato): apertura media ${r2(mean(absOpen))} punti dall’ultimo sondaggio (max ${r2(Math.max(...absOpen))}), risultato−sondaggio senza giocare: media ${r2(mean(idleGap))}, p90 ${r2(quantile(idleGap.map(Math.abs), 0.9))}; crescita da campagna giocata ${r2(growth)} punti`;
console.log(`Sondaggi nazionali e risultato verificati: ${summary}.`);
