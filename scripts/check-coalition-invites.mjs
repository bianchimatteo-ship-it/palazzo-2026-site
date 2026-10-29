// Coalitions that grow: the player's party, once in an intesa, invites a third and a fourth force (and more) into it. The world engine (world-engine.js) with the real rules of the game, then the
// store (the secretary, the window of the lists, time and political capital, save and reload) and the effects on polls, campaign bonus and the electoral coalitions of the national vote.
//   - intesa of 2 → coalition of 3 → 4 and 5: name, members, leader, kind, no ceiling at two;
//   - odds with reasons (position, relations with the members, distance from the leader, rancours), success and refusal, the talks on conditions, the outcome and the chronicle;
//   - a force already in another accord: it brings its partners along and its conditions are kept, or the invitation is blocked with the reason (nothing is pulled out in silence);
//   - leaving: the player's party (also as leader) and a member walk out, the others and the leadership stay coherent; nobody is in two active accords;
//   - save and reload; polls, campaign bonus and the electoral coalitions follow the larger coalition;
//   - on the real store: only the secretary, 1 day and 4 points of capital, the lists-filed window blocks it.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const build = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const W = await import(`../src/core/world-engine.js${v}`);
const L = await import(`../src/core/legislature-engine.js${v}`);
const { checkInvariants } = await import(`../src/core/invariants.js${v}`);
const UI = await import(`../src/ui/polls-mode.js${v}`);

const forces = [
  { id: 'fdi', label: 'Destra A', share: 26.6, position: 'destra', governing: true },
  { id: 'pd', label: 'Centrosinistra A', share: 21.1, position: 'centro-sinistra' },
  { id: 'm5s', label: 'Centrosinistra B', share: 12.5, position: 'centro-sinistra' },
  { id: 'fn', label: 'Destra B', share: 7.7, position: 'destra' },
  { id: 'fi', label: 'Centrodestra A', share: 7.4, position: 'centro-destra', governing: true },
  { id: 'avs', label: 'Sinistra A', share: 6.4, position: 'sinistra' },
  { id: 'lega', label: 'Destra C', share: 5.6, position: 'destra', governing: true },
  { id: 'az', label: 'Centro A', share: 3.3, position: 'centro' },
  { id: 'iv', label: 'Centro B', share: 2.3, position: 'centro' },
  { id: 'pe', label: 'Centro C', share: 1.5, position: 'centro' }
];
const realPoll = { id: 'test', label: 'Media reale di prova', publishedAt: '2026-09-17', sourceUrl: 'https://example.org/sondaggio', sourceName: 'Fonte di prova', results: forces.map(item => ({ partyId: item.id, share: item.share })) };
const DATE = '2026-09-24';
const base = () => W.createWorld({ seedText: 'inviti', date: DATE, place: { region: 'Lazio' }, playerParty: { id: 'io', label: 'Il mio partito', position: 'centro-sinistra', founder: true }, forces, realPoll });
const fresh = (world, n) => { const copy = structuredClone(world); copy.rngState = 1000 + n * 7919; return copy; };
const lines = [];
const active = world => world.alliances.filter(item => item.status === 'active' && item.partyIds.length >= 2);
const doubleMembership = world => { const seen = new Map(); for (const alliance of active(world)) for (const id of alliance.partyIds) seen.set(id, [...(seen.get(id) ?? []), alliance.id]); return [...seen].filter(([, list]) => list.length > 1).map(([id, list]) => `${id}: ${list.join(', ')}`); };
const coherent = (world, label) => {
  assert.deepEqual(doubleMembership(world), [], `${label}: nessun partito in due accordi attivi.`);
  for (const alliance of active(world)) {
    assert.ok(alliance.partyIds.every(id => world.parties.some(item => item.id === id && item.active)), `${label}: ${alliance.label}: tutti i membri esistono.`);
    if (alliance.leaderId) assert.ok(alliance.partyIds.includes(alliance.leaderId), `${label}: ${alliance.label}: la guida è un membro.`);
    if (/^Coalizione guidata da /.test(alliance.label)) assert.ok(alliance.partyIds.map(id => world.parties.find(item => item.id === id).label).some(name => alliance.label === `Coalizione guidata da ${name}`), `${label}: il nome indica un membro (${alliance.label}).`);
  }
};
// An intesa of the player's party with `partner`, tried with different draws.
function intesa(world, partner) {
  for (let n = 0; n < 80; n++) { const out = W.proposeAlliance(fresh(world, n), partner, { date: DATE }); if (out.success) return out.world; }
  throw new Error(`Nessuna intesa con ${partner} in 80 prove.`);
}
// An invitation that succeeds (and, separately, one that is refused) with different draws.
function invite(world, id, want = true) {
  for (let n = 0; n < 120; n++) { const out = W.inviteToAlliance(fresh(world, n), id, { date: DATE }); if (out.success === want) return out; }
  throw new Error(`Nessun invito ${want ? 'riuscito' : 'rifiutato'} per ${id} in 120 prove.`);
}

// ---------- 1. from intesa to coalition of 3, 4, 5 ----------
let world = intesa(base(), 'pd');
{
  const own = W.playerAlliance(world);
  assert.deepEqual([...own.partyIds].sort(), ['io', 'pd']); assert.match(own.label, /^Intesa /);
  assert.equal(W.allianceKind(world, own).kind, 'intesa', 'A due è un’intesa.');
  assert.equal(W.inviteBlock(world, 'm5s'), null, 'Da alleato si può invitare un terzo partito.');
  assert.match(W.inviteBlock(base(), 'pd') ?? '', /Prima concludi un’intesa/, 'Senza alleanza non si invita: prima si propone un’intesa.');
  assert.match(W.inviteBlock(world, 'pd') ?? '', /già nella tua coalizione/, 'Un membro non si invita due volte.');
  const third = invite(world, 'm5s');
  world = third.world;
  const coalition = W.playerAlliance(world);
  assert.equal(coalition.partyIds.length, 3); assert.ok(coalition.partyIds.includes('m5s'));
  assert.equal(W.allianceKind(world, coalition).kind, 'coalizione', 'Alla seconda adesione l’intesa diventa coalizione.');
  assert.match(coalition.label, /^Coalizione guidata da /, 'Il nome segue.');
  assert.equal(coalition.leaderId, 'pd', 'La guida è il partito più grande, o chi l’ha ottenuta in trattativa.');
  assert.ok(coalition.history.some(item => /Centrosinistra B/.test(item.text)), 'La storia registra l’ingresso.');
  assert.ok(world.events.some(item => item.kind === 'alleanza' && /Centrosinistra B/.test(item.title)), 'La cronaca racconta l’adesione.');
  assert.deepEqual(third.joined, ['m5s']); assert.ok(third.reasons.length >= 3 && third.chance > 0);
  coherent(world, '3 membri');
  const fourth = invite(world, 'avs'); world = fourth.world;
  assert.equal(W.playerAlliance(world).partyIds.length, 4, 'Nessun limite a due membri: la coalizione cresce a quattro.');
  const fifth = invite(world, 'az'); world = fifth.world;
  assert.equal(W.playerAlliance(world).partyIds.length, 5, '…e a cinque.');
  assert.equal(W.allianceKind(world, W.playerAlliance(world)).kind, 'coalizione');
  assert.ok(W.playerAlliance(world).withPlayer === true);
  coherent(world, '5 membri');
  lines.push('intesa a 2 → coalizione a 3, 4, 5 (nome, membri, guida, tipo, storia, cronaca)');
}
const five = world;

// ---------- 2. odds with reasons; refusal; talks ----------
{
  const start = intesa(base(), 'pd');
  const odds = W.inviteOdds(start, 'm5s', {});
  const labels = odds.reasons.map(item => item.label).join(' | ');
  assert.match(labels, /Collocazione/); assert.match(labels, /Rapporti con gli altri membri/); assert.match(labels, /Distanza dal capofila/); assert.match(labels, /Strategia/);
  assert.ok(!/già in un’altra intesa/.test(labels), 'L’accordo preesistente non è una penalità: si gestisce con la fusione.');
  // relations, rancour and difficulty move the odds
  const warm = structuredClone(start); warm.ties[['m5s', 'pd'].sort().join('|')] = 80; warm.parties.find(item => item.id === 'm5s').playerRelation = 60;
  const cold = structuredClone(start); cold.ties[['m5s', 'pd'].sort().join('|')] = -80; cold.parties.find(item => item.id === 'm5s').playerRelation = -60; cold.grudges[['m5s', 'pd'].sort().join('|')] = 60;
  const oddsWarm = W.inviteOdds(warm, 'm5s', {}), oddsCold = W.inviteOdds(cold, 'm5s', {});
  assert.ok(oddsWarm.chance > odds.chance && odds.chance > oddsCold.chance, `Rapporti e rancori pesano (${oddsWarm.chance} > ${odds.chance} > ${oddsCold.chance}).`);
  assert.ok(oddsCold.reasons.some(item => /Rancori con Centrosinistra A/.test(item.label) && item.delta < 0), 'Il rancore con un membro è una ragione.');
  assert.ok(W.inviteOdds(start, 'm5s', { memory: { good: 0, bad: 3 } }).chance < odds.chance, 'La memoria di rotture passate pesa.');
  assert.equal(W.inviteOdds(start, 'fdi', {}).chance, 0.03, 'Una forza lontana accetta solo per eccezione.');
  // refusals: the coalition stays as it was, the relation with the force drops, the chronicle says why
  const refused = invite(start, 'fdi', false);
  assert.equal(refused.stage, 'rifiuto'); assert.deepEqual(active(refused.world).find(item => item.partyIds.includes('io')).partyIds.sort(), ['io', 'pd']);
  assert.ok(refused.world.parties.find(item => item.id === 'fdi').playerRelation < start.parties.find(item => item.id === 'fdi').playerRelation, 'Il rifiuto raffredda i rapporti.');
  assert.ok(refused.world.events[0].kind === 'rottura' && /respinge l’invito/.test(refused.world.events[0].title) && refused.world.events[0].body.length > 20, 'Il rifiuto è raccontato con le ragioni.');
  assert.ok(refused.reasons.some(item => item.delta < 0));
  // accepted and refused across many draws, with talks for the force that counts
  let joined = 0, failedTalks = 0, said = 0, conceded = new Set();
  for (let n = 0; n < 160; n++) {
    const out = W.inviteToAlliance(fresh(start, n), 'm5s', { date: DATE });
    if (out.success) { joined++; if (out.term) conceded.add(out.term.kind); assert.equal(W.playerAlliance(out.world).partyIds.length, 3); if (out.term?.kind === 'guida') assert.equal(W.playerAlliance(out.world).leaderId, 'm5s', 'La guida concessa in trattativa passa a chi l’ha ottenuta.'); }
    else if (out.stage === 'trattativa') { failedTalks++; assert.ok(out.term?.text, 'La trattativa fallita dice cosa si chiedeva.'); assert.equal(W.playerAlliance(out.world).partyIds.length, 2, 'Una trattativa fallita non cambia la coalizione.'); assert.notEqual(out.term.kind, 'x'); }
    else said++;
  }
  assert.ok(joined >= 5 && said >= 5, `Gli inviti riescono e falliscono (${joined} adesioni, ${said} rifiuti, ${failedTalks} trattative fallite).`);
  assert.ok(conceded.size >= 1 || failedTalks >= 1, 'Le forze che pesano trattano le condizioni.');
  lines.push(`probabilità motivate, ${joined} adesioni / ${said} rifiuti / ${failedTalks} trattative fallite su 160 prove, condizioni ${[...conceded].join('/') || 'nessuna'}`);
}

// ---------- 3. a force already in another accord ----------
{
  const start = intesa(base(), 'pd');
  // incompatible partner: Destra A and Destra B run together; inviting one of them would pull the other into a coalition of the centre-left, or leave them split
  const withRight = structuredClone(start);
  withRight.alliances.push({ id: 'accordo-destra', label: 'Intesa Destra A – Destra B', partyIds: ['fdi', 'fn'], cohesion: 70, since: DATE, status: 'active', motive: 'prova', source: 'simulation' });
  const reason = W.inviteBlock(withRight, 'fn');
  assert.match(reason ?? '', /fa già parte dell’accordo «Intesa Destra A – Destra B»/); assert.match(reason, /non è compatibile|non sono compatibili/); assert.match(reason, /bloccato/);
  assert.throws(() => W.inviteToAlliance(withRight, 'fn', { date: DATE }), /bloccato/);
  const stillThere = active(withRight).find(item => item.id === 'accordo-destra');
  assert.deepEqual(stillThere.partyIds, ['fdi', 'fn']); assert.equal(stillThere.status, 'active', 'L’accordo preesistente è intatto.');
  // the bilateral proposal does not take a member out of another accord either
  const alone = base(); alone.alliances.push({ id: 'accordo-pd-m5s', label: 'Intesa Centrosinistra A – Centrosinistra B', partyIds: ['pd', 'm5s'], cohesion: 70, since: DATE, status: 'active', motive: 'prova', source: 'simulation' });
  assert.match(W.allianceBlock(alone, 'pd') ?? '', /fa già parte dell’accordo «Intesa Centrosinistra A – Centrosinistra B»/); assert.throws(() => W.proposeAlliance(alone, 'pd', { date: DATE }), /fa già parte/);
  // compatible accord: it merges into the coalition, with its partners and its conditions
  const centre = structuredClone(start);
  centre.alliances.push({ id: 'accordo-centro', label: 'Intesa Centro A – Centro B', partyIds: ['az', 'iv'], cohesion: 50, since: DATE, status: 'active', motive: 'prova', terms: [{ id: 'accordo-centro|collegi|1', kind: 'collegi', partyId: 'az', text: 'Centro A chiede più collegi di quanto pesa', date: DATE, status: 'aperto' }], source: 'simulation' });
  for (const pair of [['iv', 'pd'], ['io', 'iv'], ['az', 'pd'], ['az', 'io']]) centre.ties[pair.sort().join('|')] = 60;
  assert.equal(W.inviteBlock(centre, 'az'), null, 'Un accordo compatibile non blocca l’invito.');
  assert.ok(W.inviteOdds(centre, 'az', {}).merge?.partners.includes('Centro B'), 'Le probabilità dicono che l’accordo confluisce con i suoi partner.');
  const merged = invite(centre, 'az');
  const grown = W.playerAlliance(merged.world);
  assert.ok(['io', 'pd', 'az', 'iv'].every(id => grown.partyIds.includes(id)), 'La forza invitata porta con sé il suo partner.');
  assert.equal(merged.world.alliances.find(item => item.id === 'accordo-centro').status, 'merged'); assert.equal(merged.world.alliances.find(item => item.id === 'accordo-centro').mergedInto, grown.id);
  assert.ok((grown.terms ?? []).some(term => term.id === 'accordo-centro|collegi|1' && term.status === 'aperto'), 'Le condizioni dell’accordo che confluisce restano.');
  assert.ok(merged.merged && /Intesa Centro A – Centro B/.test(merged.merged) && /confluisce nella coalizione/.test(merged.world.events[0].body), 'La fusione è dichiarata nell’esito e nella cronaca.');
  assert.deepEqual(merged.joined.sort(), ['az', 'iv']);
  coherent(merged.world, 'fusione');
  lines.push('accordi preesistenti: incompatibile bloccato con il motivo e lasciato intatto, compatibile fuso con partner e condizioni');
}

// ---------- 4. leaving ----------
{
  // the player walks out of a coalition of five: the others stay together, with a leader that is a member and a name that follows
  const out = W.breakAlliance(structuredClone(five), W.playerAlliance(five).id, '2026-11-01');
  const rest = out.alliances.find(item => item.id === W.playerAlliance(five).id);
  assert.equal(rest.status, 'active'); assert.ok(!rest.partyIds.includes('io') && rest.partyIds.length === 4);
  assert.equal(W.allianceOf(out, 'io'), null, 'Il partito del giocatore è di nuovo autonomo.');
  assert.ok(out.parties.filter(item => rest.partyIds.includes(item.id)).every(item => item.playerRelation < five.parties.find(p => p.id === item.id).playerRelation), 'I rapporti con gli ex alleati ne risentono.');
  coherent(out, 'uscita del giocatore');
  // the player is the leader (a condition obtained): his exit hands the leadership to the largest member and renames the coalition
  const led = structuredClone(five); const own = W.playerAlliance(led); own.leaderId = 'io'; own.label = 'Coalizione guidata da Il mio partito';
  const left = W.breakAlliance(led, own.id, '2026-11-01');
  const after = left.alliances.find(item => item.id === own.id);
  assert.equal(after.leaderId, 'pd', 'Uscito il leader, guida il più grande dei rimasti.'); assert.equal(after.label, 'Coalizione guidata da Centrosinistra A', 'E il nome lo segue.');
  assert.ok(after.history.some(item => /La guida passa a Centrosinistra A/.test(item.text)));
  coherent(left, 'uscita del leader');
  // a member walks out on his own: the coalition loses its farthest member when cohesion collapses, the leader and the others stay
  let drifting = structuredClone(five); let date = DATE, member = null;
  W.playerAlliance(drifting).cohesion = 8;
  for (let week = 2; week <= 60 && !member; week++) {
    date = new Date(Date.parse(`${date}T12:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
    drifting = W.advanceWorld(drifting, { date, week, stats: {}, society: { mood: 50, moodDelta: 0, trust: 48, sentiment: 0 }, playerIsLeader: true, nationalVoteIn: 70 - week }).world;
    const current = drifting.alliances.find(item => item.id === W.playerAlliance(five).id);
    if (current && current.status === 'active' && current.partyIds.length < 5) member = current;
    if (current && !current.partyIds.includes('io')) break;
  }
  const current = drifting.alliances.find(item => item.id === W.playerAlliance(five).id);
  assert.ok(current && current.partyIds.length < 5, 'Con la coesione a pezzi un membro lascia la coalizione.');
  assert.ok(drifting.events.some(item => item.kind === 'rottura' && /lascia|Si rompe/.test(item.title)), 'L’uscita è nella cronaca.');
  coherent(drifting, 'uscita di un membro');
  lines.push('uscita del giocatore, del leader (guida e nome passano al più grande) e di un membro, senza doppie appartenenze');
}

// ---------- 5. save and reload ----------
{
  const reloaded = W.normalizeWorld(JSON.parse(JSON.stringify(five)));
  assert.deepEqual(W.playerAlliance(reloaded).partyIds, W.playerAlliance(five).partyIds);
  assert.equal(W.playerAlliance(reloaded).leaderId, W.playerAlliance(five).leaderId); assert.equal(W.playerAlliance(reloaded).label, W.playerAlliance(five).label);
  coherent(reloaded, 'ricaricata');
  // and the next invitation works on the reloaded world
  const more = invite(reloaded, 'iv');
  assert.equal(W.playerAlliance(more.world).partyIds.length, 6);
  lines.push('salvataggio e ricaricamento (coalizione a 5, poi a 6)');
}

// ---------- 6. the effects: polls, campaign bonus, electoral coalitions and seats ----------
{
  const two = intesa(base(), 'pd'); const four = invite(invite(two, 'm5s').world, 'avs').world;
  // polls: the entry gives a lift to the player and the new member (an effect of the world), shown in the next poll
  assert.ok(four.effects.some(item => item.partyId === 'io' && item.cause === 'alleanza') && four.effects.some(item => item.partyId === 'avs' && item.cause === 'alleanza'), 'L’ingresso muove i sondaggi di chi è coinvolto.');
  const control = structuredClone(four); control.effects = control.effects.filter(item => item.cause !== 'alleanza');
  const step = world => W.advanceWorld(world, { date: '2026-10-01', week: 2, stats: {}, society: { mood: 50, moodDelta: 0, trust: 48, sentiment: 0 } }).world;
  const withEffect = step(structuredClone(four)), without = step(control);
  const share = (world, id) => W.latestPoll(world).results.find(row => row.partyId === id).share;
  const members = ['io', 'pd', 'm5s', 'avs'], sum = world => members.reduce((total, id) => total + share(world, id), 0);
  assert.ok(sum(withEffect) > sum(without), `Il sondaggio successivo è più alto per i membri (${sum(without).toFixed(1)}% → ${sum(withEffect).toFixed(1)}%, stessa estrazione con e senza effetto).`);
  // campaign bonus of the allies: it grows with the members
  const bonusTwo = W.campaignPollBonus(two, 'politiche', {}, []), bonusFour = W.campaignPollBonus(four, 'politiche', {}, []);
  assert.ok(bonusFour.allies > bonusTwo.allies && bonusFour.alliesTerm > bonusTwo.alliesTerm, `Gli alleati della campagna crescono con i membri (${bonusTwo.allies}% → ${bonusFour.allies}%).`);
  assert.ok(bonusFour.bonus >= bonusTwo.bonus, 'E il bonus con loro.');
  // electoral coalitions: the four run together, the player's party with them
  const coalitions = L.buildCoalitions(four);
  const home = L.coalitionOf(coalitions, 'io');
  assert.ok(home && ['io', 'pd', 'm5s', 'avs'].every(id => home.partyIds.includes(id)), 'Alle politiche i quattro corrono nella stessa coalizione.');
  // seats: the coalition is one list at the vote. Inviting a small centre force that would run alone takes its votes into the coalition of the player's party.
  const vote = world => { const list = L.buildCoalitions(world); const result = L.runNationalVote({ world, coalitions: list, date: '2027-03-01', seed: 'inviti', noise: false }); const mine = L.coalitionOf(list, 'io'); return { list, mine, row: result.camera.coalitions.find(item => item.id === mine?.id) ?? null, result }; };
  const before = vote(two), grown = vote(invite(two, 'az').world);
  assert.ok(!before.mine?.partyIds.includes('az'), 'Da sola la forza del centro non è nella coalizione del giocatore.');
  assert.ok(grown.mine?.partyIds.includes('az') && grown.mine.partyIds.includes('io'), 'Invitata, corre nella sua coalizione elettorale.');
  assert.ok(grown.row && before.row && grown.row.share > before.row.share && grown.row.seats >= before.row.seats, `Il voto nazionale conta la coalizione ampliata (${before.row?.share}% e ${before.row?.seats} seggi → ${grown.row?.share}% e ${grown.row?.seats}).`);
  lines.push('sondaggi (effetto dell’ingresso), bonus degli alleati, coalizioni elettorali e voto nazionale con la coalizione a quattro');
}

// ---------- 7. the store: the secretary, the window, time and capital, save and reload ----------
{
  const { startCareer } = await import('./lib/long-run.mjs');
  const run = await startCareer({ seed: 'inviti-store', level: 'deputato', fast: true });
  const { store } = run;
  const state = store.getState();
  state.game.party.affiliation = 'founder'; state.game.party.rank = 5;
  store.advance(7);
  const world = store.getState().world;
  assert.ok(world?.playerPartyId, 'Il mondo ha il partito del giocatore.');
  const player = world.parties.find(item => item.isPlayer);
  const candidates = world.parties.filter(item => item.active && !item.isPlayer && W.isSurveyed(item) && !W.allianceOf(world, item.id)).sort((a, b) => Math.abs((a.axis ?? 0) - (player.axis ?? 0)) - Math.abs((b.axis ?? 0) - (player.axis ?? 0)));
  assert.ok(candidates.length >= 3);
  assert.match(store.inviteBlock(candidates[0].id) ?? '', /Prima concludi un’intesa/, 'Senza intesa non si invita.');
  assert.throws(() => store.inviteToAlliance(candidates[0].id), /Prima concludi un’intesa/);
  // the first intesa, by the usual proposal (capital and a day), until one is agreed
  const capital = () => store.getState().game.resources.politicalCapital;
  const setCapital = value => { store.getState().game.resources.politicalCapital = value; };
  const grid = (extra = {}) => { const current = store.getState(); return UI.forcesGrid(current, current.world, W.latestPoll(current.world), UI.partyIndex(current.world), () => null, () => null, true, { allianceOdds: id => store.allianceOdds(id), inviteOdds: id => store.inviteOdds(id), inviteBlock: id => store.inviteBlock(id), allianceBlock: id => store.allianceBlock(id), ...extra }); };
  const before = grid();
  assert.ok(/Proponi un’intesa/.test(before) && !/Invita nella coalizione/.test(before) && !/Visualizza coalizione/.test(before), 'Da autonomo: «Proponi un’intesa», non «Invita» né «Visualizza coalizione».');
  let signed = null;
  for (const partner of candidates.slice(0, 6)) { setCapital(40); if (store.allianceBlock(partner.id)) continue; const result = store.proposeAlliance(partner.id); if (result.success) { signed = partner; break; } }
  assert.ok(signed, 'Si conclude una prima intesa.');
  assert.ok(W.allianceOf(store.getState().world, player.id)?.partyIds.length === 2);
  const allied = grid();
  assert.ok(/Invita nella coalizione/.test(allied) && !/Proponi un’intesa/.test(allied), 'Da alleato: «Invita nella coalizione» al posto di «Proponi un’intesa».');
  assert.ok(/data-my-coalition=/.test(allied) && /La mia coalizione/.test(allied) && /Coesione/.test(allied) && /Esci dall’accordo/.test(allied) && /Intesa politica/.test(allied), '«La mia coalizione» mostra membri, coesione, i comandi e il tipo.');
  assert.equal((allied.match(/data-coalition-member=/g) ?? []).length, 2, 'La coalizione è in un solo pannello, senza ripetizioni sulle schede.');
  assert.equal((allied.match(/data-my-coalition=/g) ?? []).length, 1);
  assert.ok(/Probabilità che accetti/.test(allied), 'Ogni invito mostra le probabilità e le ragioni.');
  assert.ok(!/Invita nella coalizione/.test(grid({ windowClosed: true })) && /Intese ferme fino al voto/.test(grid({ windowClosed: true })), 'A liste depositate niente comandi.');
  // inviting: 4 points of capital and a day, a report with the reasons, only for the secretary
  const left = candidates.filter(item => item.id !== signed.id && !W.allianceOf(store.getState().world, item.id) && !store.inviteBlock(item.id));
  assert.ok(left.length >= 2, 'Ci sono altre forze da invitare.');
  const target = left[0];
  setCapital(3);
  assert.throws(() => store.inviteToAlliance(target.id), /Servono 4 punti di capitale politico/);
  setCapital(40);
  let result = null, tried = 0;
  const odds = store.inviteOdds(target.id);
  assert.ok(odds.reasons.length >= 3 && odds.chance > 0, 'Le probabilità sono motivate.');
  for (const option of left.slice(0, 6)) { setCapital(40); const before = capital(); const outcome = store.inviteToAlliance(option.id); tried++; assert.equal(capital(), before - 4, 'Un invito costa 4 punti di capitale politico.'); const report = store.getState().ui.allianceReport; assert.ok(report && report.partyId === option.id && report.reasons.length >= 3 && typeof report.success === 'boolean', 'L’esito resta con le ragioni.'); if (outcome.success) { result = outcome; break; } else assert.ok(!W.allianceOf(store.getState().world, option.id) || W.allianceOf(store.getState().world, option.id) !== W.playerAlliance(store.getState().world), 'Un rifiuto non cambia la coalizione.'); }
  assert.ok(result?.success, `Un invito riesce (${tried} tentativi).`);
  const grown = W.playerAlliance(store.getState().world);
  const afterInvite = grid();
  assert.ok(/data-alliance-report/.test(afterInvite) && /Perché/.test(afterInvite) && /Probabilità di successo/.test(afterInvite), 'La pagina mostra l’esito dell’invito con le ragioni.');
  assert.ok((afterInvite.match(/data-coalition-member=/g) ?? []).length >= 3 && /Coalizione politica/.test(afterInvite), 'La coalizione ampliata ha tutti i membri nel pannello ed è «Coalizione politica».');
  assert.ok(grown.partyIds.length >= 3 && W.allianceKind(store.getState().world, grown).kind === 'coalizione');
  assert.deepEqual(doubleMembership(store.getState().world), []);
  assert.ok(checkInvariants(store.getState()).issues.every(item => !/appartiene a due accordi|due accordi/.test(item.message)), 'Lo stato non ha doppie appartenenze.');
  // the vote of the lists: the window blocks invitations and exits
  const election = store.getState().game.elections.find(item => ['politiche', 'europee'].includes(item.type) && item.status !== 'held');
  assert.ok(election, 'C’è un voto nazionale o europeo in calendario.');
  // only the secretary decides, and from the filing of the lists to the vote nothing changes
  const party = store.getState().game.party; const roleBefore = { affiliation: party.affiliation, rank: party.rank };
  party.affiliation = 'member'; party.rank = 1;
  assert.throws(() => store.inviteToAlliance(left.find(item => !W.allianceOf(store.getState().world, item.id))?.id ?? left[0].id), /segretario|fondatore/i, 'Solo il segretario invita.');
  party.affiliation = roleBefore.affiliation; party.rank = roleBefore.rank;
  const dateBefore = store.getState().clock.currentDate;
  store.getState().clock.currentDate = new Date(Date.parse(`${election.windowClosesAt}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  assert.equal(store.allianceWindow().open, false, 'Le liste sono depositate.');
  const free = left.find(item => !W.allianceOf(store.getState().world, item.id));
  if (free) assert.throws(() => store.inviteToAlliance(free.id), /depositate/, 'Dopo il deposito delle liste non si invita.');
  // (leaving is allowed to the secretary even then: it is checked in check-alliance-exit)
  store.getState().clock.currentDate = dateBefore;
  const saved = JSON.parse(store.exportSave());
  assert.equal(W.playerAlliance(saved.world).id, grown.id, 'Il salvataggio contiene la coalizione.');
  store.loadGame(saved);
  assert.deepEqual(W.playerAlliance(store.getState().world).partyIds, grown.partyIds, 'Ricaricata, la coalizione è la stessa.');
  assert.equal(store.getState().ui.allianceReport?.success, true, 'Anche l’esito dell’ultimo invito è nel salvataggio.');
  lines.push('store: solo il segretario, 4 punti e un giorno, esito con le ragioni, salvataggio e ricaricamento');
}

console.log(`Coalizioni ampliabili: ${lines.join('; ')}.`);
process.exit(0);
