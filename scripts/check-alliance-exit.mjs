// Leaving an accord and keeping accords whole: the secretary can always leave his own intesa or coalition (also with the lists of a general election filed), told first what it does; the lists already
// filed are frozen and the vote uses them; leaving from an intesa ends it, from a coalition of three or more only the player's party goes; a crisis of cohesion takes out one member (the player's
// party included) and not the whole coalition; no accord loses members or conditions without a recorded decision; nobody is in two accords.
// World engine (world-engine.js) and real store (store.js, the lists of the politiche of the game, save and reload, the vote); the page itself in check-alliance-exit-browser.mjs.
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
const base = (position = 'centro-sinistra') => W.createWorld({ seedText: 'uscite', date: DATE, place: { region: 'Lazio' }, playerParty: { id: 'io', label: 'Il mio partito', position, founder: true }, forces, realPoll });
const fresh = (world, n) => { const copy = structuredClone(world); copy.rngState = 1000 + n * 7919; return copy; };
const lines = [];
const active = world => world.alliances.filter(item => item.status === 'active' && item.partyIds.length >= 2);
const doubleMembership = world => { const seen = new Map(); for (const alliance of active(world)) for (const id of alliance.partyIds) seen.set(id, [...(seen.get(id) ?? []), alliance.id]); return [...seen].filter(([, list]) => list.length > 1).map(([id, list]) => `${id}: ${list.join(', ')}`); };
const coherent = (world, label) => {
  assert.deepEqual(doubleMembership(world), [], `${label}: nessun partito in due accordi attivi.`);
  for (const alliance of active(world)) {
    if (alliance.leaderId) assert.ok(alliance.partyIds.includes(alliance.leaderId), `${label}: ${alliance.label}: la guida è un membro.`);
    if (/^Coalizione guidata da /.test(alliance.label)) assert.ok(alliance.partyIds.some(id => alliance.label === `Coalizione guidata da ${world.parties.find(item => item.id === id).label}`), `${label}: il nome indica un membro (${alliance.label}).`);
  }
};
const intesa = (world, partner) => { for (let n = 0; n < 80; n++) { const out = W.proposeAlliance(fresh(world, n), partner, { date: DATE }); if (out.success) return out.world; } throw new Error(`Nessuna intesa con ${partner}.`); };
const invite = (world, id) => { for (let n = 0; n < 160; n++) { const out = W.inviteToAlliance(fresh(world, n), id, { date: DATE }); if (out.success) return out.world; } throw new Error(`Nessun invito riuscito per ${id}.`); };
const grow = (ids) => { let world = intesa(base(), ids[0]); for (const id of ids.slice(1)) world = invite(world, id); return world; };
const exit = (world, date = '2026-11-01') => W.breakAlliance(structuredClone(world), W.playerAlliance(world).id, date);

// ---------- 1. leaving an intesa and coalitions of 3, 4 and more ----------
{
  const two = grow(['pd']);
  const out2 = exit(two);
  const ended = out2.alliances.find(item => item.id === W.playerAlliance(two).id);
  assert.equal(ended.status, 'broken'); assert.equal(W.allianceOf(out2, 'io'), null, 'Da un’intesa di due l’accordo si interrompe.');
  assert.ok(ended.history.some(item => /rompe l’intesa/.test(item.text)), 'La cronologia lo registra.');
  assert.ok(out2.grudges[['io', 'pd'].sort().join('|')] >= 50 && out2.parties.find(item => item.id === 'pd').playerRelation < two.parties.find(item => item.id === 'pd').playerRelation, 'Rapporti e rancore.');
  assert.ok(out2.effects.some(item => item.partyId === 'io' && item.cause === 'rottura' && item.delta < 0), 'E i sondaggi del partito che rompe.');
  coherent(out2, 'intesa');
  for (const size of [3, 4, 5]) {
    const members = ['pd', 'm5s', 'avs', 'az', 'iv'].slice(0, size - 1);
    const world = grow(members);
    const own = W.playerAlliance(world);
    assert.equal(own.partyIds.length, size);
    const out = exit(world);
    const rest = out.alliances.find(item => item.id === own.id);
    assert.equal(rest.status, 'active', `Da una coalizione di ${size} esce solo il partito del giocatore.`);
    assert.deepEqual([...rest.partyIds].sort(), own.partyIds.filter(id => id !== 'io').sort());
    assert.equal(W.allianceOf(out, 'io'), null);
    assert.ok(rest.cohesion < own.cohesion, 'La coesione ne risente.');
    assert.ok(rest.history.some(item => /esce dall’accordo: gli altri restano insieme/.test(item.text)), 'La cronologia dice chi è uscito.');
    assert.ok(out.events[0].kind === 'rottura' && /restano insieme/.test(out.events[0].body), 'E la cronaca.');
    assert.ok(rest.partyIds.every(id => out.grudges[['io', id].sort().join('|')] >= 50 && out.parties.find(item => item.id === id).playerRelation < world.parties.find(item => item.id === id).playerRelation), 'Rapporti più freddi e rancori con tutti i rimasti.');
    if (size === 3) { assert.equal(W.allianceKind(out, rest).kind, 'intesa'); assert.match(rest.label, /^Intesa /, 'Rimasti in due, tornano a essere un’intesa e il nome lo dice.'); }
    else { assert.equal(W.allianceKind(out, rest).kind, 'coalizione'); assert.match(rest.label, /^Coalizione guidata da /); }
    coherent(out, `coalizione di ${size}`);
  }
  lines.push('uscita da intesa e da coalizioni di 3, 4, 5 (gli altri restano, nome e tipo, coesione, rapporti, rancori, cronologia, sondaggi)');
}

// ---------- 2. the leader leaves; a member walks out; the leader is the largest of the rest ----------
{
  const world = grow(['pd', 'm5s', 'avs']);
  const led = structuredClone(world); const own = W.playerAlliance(led); own.leaderId = 'io'; own.label = 'Coalizione guidata da Il mio partito';
  const out = W.breakAlliance(led, own.id, '2026-11-01'); const after = out.alliances.find(item => item.id === own.id);
  assert.equal(after.leaderId, 'pd'); assert.equal(after.label, 'Coalizione guidata da Centrosinistra A'); assert.ok(after.history.some(item => /La guida passa a Centrosinistra A/.test(item.text)));
  coherent(out, 'uscita del leader');
  lines.push('uscita del capofila: guida e nome passano al più grande');
}

// ---------- 3. a crisis of cohesion takes out one member, the player included, not the whole coalition ----------
{
  // the player's party is the farthest from the leader (extreme left against the centre-left leader): it is the one who leaves, alone
  let world = intesa(base('estrema sinistra'), 'avs');
  world = invite(world, 'pd'); world = invite(world, 'm5s');
  const id = W.playerAlliance(world).id;
  const own = world.alliances.find(item => item.id === id); own.leaderId = 'pd'; own.label = 'Coalizione guidata da Centrosinistra A'; own.cohesion = 6;
  assert.ok(own.partyIds.length >= 3 && own.partyIds.includes('io'));
  let date = DATE, week = 1;
  for (; week < 40; week++) {
    date = new Date(Date.parse(`${date}T12:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
    world = W.advanceWorld(world, { date, week: week + 1, stats: {}, society: { mood: 50, moodDelta: 0, trust: 48, sentiment: 0 }, playerIsLeader: true, nationalVoteIn: 80 }).world;
    if (!world.alliances.find(item => item.id === id).partyIds.includes('io')) break;
  }
  const crisis = world.alliances.find(item => item.id === id);
  assert.ok(!crisis.partyIds.includes('io'), 'La crisi di coesione porta fuori il membro più distante: il partito del giocatore.');
  assert.equal(crisis.status, 'active', 'La coalizione NON si scioglie solo perché il più distante è il giocatore.'); assert.ok(crisis.partyIds.length >= 2);
  assert.ok(crisis.history.some(item => /i partner non reggono più la distanza dal tuo partito/.test(item.text)), 'La spiegazione è nella cronologia.');
  const event = world.events.find(item => item.kind === 'rottura' && /Il mio partito lascia/.test(item.title));
  assert.ok(event && /distanza|veti/.test(event.body), 'E nella cronaca, con il motivo.');
  assert.equal(W.allianceOf(world, 'io'), null); assert.ok(crisis.withPlayer === false);
  assert.ok(world.effects.some(item => item.partyId === 'io' && item.cause === 'rottura'), 'Con le conseguenze sui sondaggi.');
  coherent(world, 'crisi con il giocatore più distante');
  // an intesa of two in the same crisis ends (it has no one left to stay together)
  let pair = intesa(base('estrema sinistra'), 'avs'); const pairId = W.playerAlliance(pair).id; pair.alliances.find(item => item.id === pairId).cohesion = 4;
  let d2 = DATE;
  for (let w = 1; w < 40 && W.allianceOf(pair, 'io'); w++) { d2 = new Date(Date.parse(`${d2}T12:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10); pair = W.advanceWorld(pair, { date: d2, week: w + 1, stats: {}, society: { mood: 50, moodDelta: 0, trust: 48, sentiment: 0 }, playerIsLeader: true, nationalVoteIn: 80 }).world; }
  assert.equal(W.allianceOf(pair, 'io'), null); assert.equal(pair.alliances.find(item => item.id === pairId).status, 'broken', 'Un’intesa di due in crisi si rompe.');
  lines.push('crisi di coesione: esce solo il giocatore (spiegato in cronaca e cronologia), la coalizione resta; l’intesa di due si rompe');
}

// ---------- 4. no accord loses members or conditions in silence ----------
{
  const world = grow(['pd']);
  // an accord that exists: the proposal and the acceptance do not take a member out of it
  const other = base(); other.alliances.push({ id: 'accordo-pd-m5s', label: 'Intesa Centrosinistra A – Centrosinistra B', partyIds: ['pd', 'm5s'], cohesion: 70, since: DATE, status: 'active', source: 'simulation' });
  assert.throws(() => W.proposeAlliance(other, 'pd', { date: DATE }), /fa già parte/); assert.equal(W.acceptAlliance(other, 'pd', DATE).alliances.length, other.alliances.length, 'Accettare un’offerta di un partito già in un accordo non lo porta via.');
  assert.deepEqual(active(other)[0].partyIds, ['pd', 'm5s']);
  // the player joins a coalition while his own accord has a partner that does not come along: the accord goes on without him, in the chronicle
  const joiner = base(); const farRight = joiner.parties.find(item => item.id === 'fdi'); void farRight;
  joiner.alliances.push({ id: 'coal-centro', label: 'Coalizione guidata da Centrosinistra A', partyIds: ['pd', 'm5s'], leaderId: 'pd', kind: 'coalizione', cohesion: 70, since: DATE, status: 'active', source: 'simulation' });
  joiner.alliances.push({ id: 'accordo-destra', label: 'Intesa Il mio partito – Destra A – Destra B', partyIds: ['io', 'fdi', 'fn'], cohesion: 60, since: DATE, status: 'active', withPlayer: true, terms: [{ id: 't1', kind: 'collegi', partyId: 'fdi', text: 'Destra A chiede più collegi di quanto pesa', date: DATE, status: 'aperto' }], source: 'simulation' });
  const joined = W.joinCoalition(joiner, 'coal-centro', '2026-10-01');
  assert.ok(joined.joined);
  const left = joined.world.alliances.find(item => item.id === 'accordo-destra');
  assert.equal(left.status, 'active', 'L’accordo di partenza continua con chi resta.'); assert.deepEqual(left.partyIds.sort(), ['fdi', 'fn']);
  assert.ok(left.terms.some(item => item.id === 't1'), 'Le sue condizioni restano.');
  assert.ok(left.history.some(item => /passa a «Coalizione guidata da Centrosinistra A»/.test(item.text)) && joined.world.events.some(item => /non è compatibile|non sono compatibili/.test(item.body) && item.kind === 'rottura'), 'Registrato nella cronologia e nella cronaca.');
  coherent(joined.world, 'adesione con accordo preesistente');
  // …and when only one partner would remain, the accord ends with a record
  const pair = base(); pair.alliances.push({ id: 'coal-centro', label: 'Coalizione guidata da Centrosinistra A', partyIds: ['pd', 'm5s'], leaderId: 'pd', kind: 'coalizione', cohesion: 70, since: DATE, status: 'active', source: 'simulation' });
  pair.alliances.push({ id: 'accordo-destra', label: 'Intesa Il mio partito – Destra A', partyIds: ['io', 'fdi'], cohesion: 60, since: DATE, status: 'active', withPlayer: true, source: 'simulation' });
  const joinedPair = W.joinCoalition(pair, 'coal-centro', '2026-10-01').world;
  assert.equal(joinedPair.alliances.find(item => item.id === 'accordo-destra').status, 'broken'); assert.ok(joinedPair.events.some(item => /si scioglie perché non resta più un partner/.test(item.body)), 'Lo scioglimento è raccontato.');
  coherent(joinedPair, 'accordo di due lasciato');
  // a force that merges into another leaves its coalition, it does not end it
  const coalition = grow(['pd', 'm5s', 'avs']);
  const absorbed = W.mergeIntoPlayerForce(coalition, { forceId: 'avs', date: '2026-12-01' });
  const afterMerge = absorbed.alliances.find(item => item.id === W.playerAlliance(coalition).id);
  assert.equal(afterMerge.status, 'active', 'La fusione di un membro non scioglie la coalizione.'); assert.ok(!afterMerge.partyIds.includes('avs') && afterMerge.partyIds.length >= 2);
  assert.ok(afterMerge.history.some(item => /Sinistra A confluisce in Il mio partito e lascia l’accordo/.test(item.text)));
  coherent(absorbed, 'fusione');
  void world;
  lines.push('proposta e accettazione non portano via membri, adesione con accordo preesistente (continua / si scioglie, con cronaca e condizioni), fusione di un membro');
}

// ---------- 5. save and reload ----------
{
  const world = grow(['pd', 'm5s', 'avs']);
  const out = exit(world);
  const back = W.normalizeWorld(JSON.parse(JSON.stringify(out)));
  const own = W.playerAlliance(world);
  assert.deepEqual(back.alliances.find(item => item.id === own.id).partyIds, out.alliances.find(item => item.id === own.id).partyIds);
  assert.equal(W.allianceOf(back, 'io'), null); coherent(back, 'ricaricata dopo l’uscita');
  assert.match(W.inviteBlock(back, 'avs') ?? '', /Prima concludi un’intesa/, 'Uscito, il giocatore non invita più nessuno.');
  lines.push('salvataggio e ricaricamento dopo l’uscita');
}

// ---------- 6. the page: «La mia coalizione» (one panel, from world.alliances), the role, the party missing from the survey ----------
{
  const world = grow(['pd', 'm5s']);
  const state = { game: { status: 'active' }, ui: {}, national: null, world };
  const poll = W.latestPoll(world);
  const index = UI.partyIndex(world);
  const opts = secretary => ({ secretary, windowClosed: false, inviteOdds: () => ({ chance: 0.4, reasons: [] }), inviteBlock: () => null, allianceOdds: () => null });
  const html = UI.forcesGrid(state, world, poll, index, () => null, () => null, true, opts(true));
  assert.equal((html.match(/data-my-coalition=/g) ?? []).length, 1, 'Un solo pannello «La mia coalizione».');
  assert.ok(/La mia coalizione/.test(html) && /Coalizione politica/.test(html) && /Capofila/.test(html) && /Coesione/.test(html) && /data-world-break=/.test(html) && /data-world-invite-selected/.test(html), 'Membri, tipo, capofila, coesione, comandi per invitare e uscire.');
  assert.equal((html.match(/data-coalition-member=/g) ?? []).length, 3, 'Niente ripetizioni sulle schede dei membri.');
  assert.ok(!/data-world-break="[^"]*"[\s\S]*data-world-break="/.test(html), 'Un solo comando di uscita.');
  // the party is not in the last survey: the panel does not depend on it
  const absent = structuredClone(poll); absent.results = absent.results.filter(row => row.partyId !== 'io');
  const missing = UI.forcesGrid(state, world, absent, index, () => null, () => null, true, opts(true));
  assert.ok(/data-my-coalition=/.test(missing) && /data-world-break=/.test(missing) && /non nell’ultima rilevazione/.test(missing), 'Il partito del giocatore non è nei sondaggi: il pannello e i comandi restano.');
  // not the secretary: the control is there, disabled, with the reason
  const member = UI.forcesGrid(state, world, poll, index, () => null, () => null, false, opts(false));
  assert.ok(/data-world-break-disabled/.test(member) && /disabled/.test(member) && /Solo il segretario del partito decide intese e coalizioni/.test(member) && !/data-world-break="/.test(member), 'Da non segretario: controllo disabilitato con il motivo preciso.');
  // closed window: leaving stays, inviting does not
  const closed = UI.forcesGrid(state, world, poll, index, () => null, () => null, true, { ...opts(true), windowClosed: true });
  assert.ok(/data-world-break="/.test(closed) && /resta quella/.test(closed) && !/data-world-invite-selected/.test(closed) && /Intese ferme fino al voto/.test(closed), 'A liste depositate si può uscire, non invitare.');
  // an accord of two is an «Intesa politica»; the registered coalition of an election is another thing
  const two = grow(['pd']);
  const registered = { ...state, world: two, national: { campaign: { electionDate: '2027-09-26', fixed: true, coalitions: [{ id: 'coalizione-pd', label: 'Centrosinistra', partyIds: ['pd', 'm5s', 'io'] }] } } };
  const html2 = UI.forcesGrid(registered, two, W.latestPoll(two), UI.partyIndex(two), () => null, () => null, true, opts(true));
  assert.ok(/Intesa politica/.test(html2) && /data-coalition-registered/.test(html2) && /Coalizione registrata per le politiche/.test(html2) && /Liste depositate: la composizione non cambia fino al voto/.test(html2) && /L’accordo politico oggi è diverso/.test(html2), 'Intesa politica, coalizione politica e coalizione registrata per l’elezione sono distinte.');
  lines.push('pagina: un solo pannello «La mia coalizione», indipendente dai sondaggi, ruolo con motivo, finestra, intesa / coalizione politica / coalizione registrata');
}

// ---------- 7. the real store: the lists filed are frozen, the secretary leaves, the vote uses them ----------
{
  const { startCareer } = await import('./lib/long-run.mjs');
  const run = await startCareer({ seed: 'uscita-store', level: 'deputato', fast: true });
  const { store } = run;
  store.getState().game.party.affiliation = 'founder'; store.getState().game.party.rank = 5;
  const nat = () => store.getState().national?.campaign ?? null;
  const date = () => store.getState().clock.currentDate;
  // until the candidacies of the politiche are open (the campaign of the lists exists) and not yet filed
  for (let i = 0; i < 160 && !(nat() && !nat().fixed); i++) store.advance(7);
  assert.ok(nat() && !nat().fixed, 'Le candidature per le politiche sono aperte, le liste non ancora depositate.');
  const world0 = store.getState().world; const player = world0.parties.find(item => item.isPlayer);
  // the world of a real career is full of accords of its own: the partner is taken out of the ones it is in (test set-up) and allied with the player's party
  const partner = world0.parties.filter(item => item.active && !item.isPlayer && W.isSurveyed(item)).sort((a, b) => Math.abs((a.axis ?? 0) - (player.axis ?? 0)) - Math.abs((b.axis ?? 0) - (player.axis ?? 0)))[0];
  const live = store.getState().world;
  for (const alliance of live.alliances.filter(item => item.status === 'active' && item.partyIds.includes(partner.id))) { alliance.partyIds = alliance.partyIds.filter(id => id !== partner.id); if (alliance.partyIds.length < 2 && alliance.partyIds.length !== 1) alliance.status = 'broken'; }
  for (const alliance of live.alliances.filter(item => item.status === 'active' && item.partyIds.includes(player.id))) alliance.status = 'broken';
  live.alliances.push({ id: 'alleanza-giocatore-prova', label: `Intesa ${player.label} – ${partner.label}`, partyIds: [player.id, partner.id], cohesion: 66, since: date(), status: 'active', withPlayer: true, motive: 'prova', source: 'simulation' });
  const setCapital = value => { store.getState().game.resources.politicalCapital = value; store.getState().game.week.ap = 7; };
  const second = live.parties.find(item => item.active && !item.isPlayer && item.id !== partner.id && W.isSurveyed(item) && !W.allianceOf(live, item.id) && !store.inviteBlock(item.id));
  if (second) for (let n = 0; n < 12 && W.playerAlliance(store.getState().world).partyIds.length < 3; n++) { setCapital(40); if (store.inviteBlock(second.id)) break; store.inviteToAlliance(second.id); }
  const alliedBefore = W.playerAlliance(store.getState().world);
  assert.ok(alliedBefore.partyIds.length >= 2);
  // one week at a time to the filing of the lists
  for (let i = 0; i < 12 && !nat().fixed; i++) store.advance(7);
  assert.ok(nat().fixed, 'Le liste sono depositate.');
  assert.equal(store.allianceWindow().open, false);
  const frozen = JSON.stringify(nat().coalitions);
  const home = nat().coalitions.find(item => item.partyIds.includes(player.id));
  assert.ok(home, 'Il partito del giocatore è nella coalizione registrata per il voto.');
  // not the secretary: cannot
  const party = store.getState().game.party; const was = { affiliation: party.affiliation, rank: party.rank };
  party.affiliation = 'member'; party.rank = 1;
  assert.throws(() => store.breakAlliance(alliedBefore.id), /Solo il segretario/); party.affiliation = was.affiliation; party.rank = was.rank;
  // the preview tells before; the exit goes through with the lists filed
  const preview = store.allianceExitPreview(alliedBefore.id);
  assert.ok(preview.windowClosed && preview.lines.some(line => /Le liste sono depositate: la composizione registrata/.test(line)) && preview.lines.some(line => /Rapporti con/.test(line)), 'Prima dell’uscita si spiegano le conseguenze, anche le liste.');
  const relationBefore = store.getState().world.parties.find(item => item.id === partner.id).playerRelation;
  // (the day after the closing and before the weekly step has fixed the lists: the exit fixes them first, from the accords as they were)
  const pre = JSON.stringify(L.buildCoalitions(store.getState().world, { playerChoice: nat().playerChoice }));
  store.getState().national.campaign.fixed = false;
  const bonusBefore = W.campaignPollBonus(store.getState().world, 'politiche', {}, []);
  store.breakAlliance(alliedBefore.id);
  assert.equal(nat().fixed, true, 'L’uscita a liste depositate le fissa prima di cambiare l’accordo.'); assert.equal(JSON.stringify(nat().coalitions), pre, 'Come erano al momento dell’uscita.');
  assert.ok(W.campaignPollBonus(store.getState().world, 'politiche', {}, []).allies < bonusBefore.allies || bonusBefore.allies === 0, 'Il bonus degli alleati della campagna segue l’accordo politico di oggi.');
  const w1 = store.getState().world;
  assert.equal(W.allianceOf(w1, player.id), null, 'Il segretario esce anche a liste depositate.');
  assert.ok(w1.parties.find(item => item.id === partner.id).playerRelation < relationBefore, 'Rapporti più freddi.');
  assert.equal(store.getState().ui.allianceReport?.kind, 'uscita', 'L’esito resta nella pagina.');
  assert.equal(JSON.stringify(nat().coalitions), frozen, 'La composizione registrata per il voto non cambia.');
  assert.deepEqual(doubleMembership(w1), []);
  assert.ok(checkInvariants(store.getState()).issues.every(item => !/due accordi/.test(item.message)));
  // save and reload: still frozen, the accord still left
  const saved = JSON.parse(store.exportSave()); store.loadGame(saved);
  assert.equal(JSON.stringify(store.getState().national.campaign.coalitions), frozen, 'Ricaricata, la composizione registrata è la stessa.'); assert.equal(W.allianceOf(store.getState().world, player.id), null);
  // the weeks to the vote: the lists stay as filed, the vote counts them
  const voteDate = nat().electionDate;
  for (let i = 0; i < 30 && date() < voteDate; i++) { store.advance(7); if (date() < voteDate) assert.equal(JSON.stringify(nat()?.coalitions ?? null), frozen, 'Fino al voto le liste restano quelle depositate.'); }
  const result = store.getState().national.lastPolitiche;
  assert.ok(result && result.date >= voteDate, `Il voto è stato scrutinato (${result?.date}).`);
  const filed = JSON.parse(frozen).map(item => [item.id, [...item.partyIds].sort()]);
  const counted = (result.coalitions ?? []).map(item => [item.id, [...item.partyIds].sort()]);
  assert.deepEqual(counted, filed, 'Scrutinio e seggi usano le coalizioni registrate al deposito, con i membri di allora.');
  assert.ok(counted.find(([id]) => id === home.id)[1].includes(player.id), 'Il partito del giocatore corre dove era registrato anche se ha lasciato l’accordo.');
  assert.ok(result.camera.coalitions.some(item => item.id === home.id && item.seats > 0 || item.id === home.id), 'E i seggi della coalizione registrata sono contati.');
  lines.push('store: liste depositate congelate, uscita del segretario permessa e spiegata, non segretario rifiutato, salvataggio e ricaricamento, voto con la composizione registrata');
}

console.log(`Uscita da intese e coalizioni: ${lines.join('; ')}.`);
process.exit(0);
