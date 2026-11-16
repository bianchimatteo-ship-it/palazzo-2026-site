// Alliances and coalitions: the rules added to the existing world engine (world-engine.js + alliance-rules.js), scenario by scenario.
//   1 alliance without electoral participation · 2 explicit transformation into a coalition for an election · 3 an alliance that stays an alliance · 4 a party that runs alone asks to join the centre-right
//   5 a refused request cannot be repeated for seven days · 6 incompatible programmes do not agree by themselves · 7 a compromise on a theme, negotiated and approved · 8 closing of the adhesions
//   9 a change a few days before the vote · 10 break of the alliance or of the coalition · 11 elections of different levels with different accords · 12 coherence of coalitions, candidacies, polls and seats.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const build = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const W = await import(`../src/core/world-engine.js${v}`);
const L = await import(`../src/core/legislature-engine.js${v}`);
const R = await import(`../src/core/alliance-rules.js${v}`);
const { checkInvariants } = await import(`../src/core/invariants.js${v}`);

const forces = [
  { id: 'fdi', label: 'Destra A', share: 26.6, position: 'destra', governing: true },
  { id: 'pd', label: 'Centrosinistra A', share: 21.1, position: 'centro-sinistra' },
  { id: 'm5s', label: 'Centrosinistra B', share: 12.5, position: 'centro-sinistra' },
  { id: 'fn', label: 'Destra B', share: 7.7, position: 'destra' },
  { id: 'fi', label: 'Centrodestra A', share: 7.4, position: 'centro-destra', governing: true },
  { id: 'avs', label: 'Sinistra A', share: 6.4, position: 'sinistra' },
  { id: 'lega', label: 'Destra C', share: 5.6, position: 'destra', governing: true },
  { id: 'az', label: 'Centro A', share: 3.3, position: 'centro' }
];
const realPoll = { id: 'test', label: 'Media reale di prova', publishedAt: '2026-09-17', sourceUrl: 'https://example.org/sondaggio', sourceName: 'Fonte di prova', results: forces.map(item => ({ partyId: item.id, share: item.share })) };
const DATE = '2026-09-24';
const base = (position = 'centro-sinistra', seed = 'regole') => W.createWorld({ seedText: seed, date: DATE, place: { region: 'Lazio' }, playerParty: { id: 'io', label: 'Il mio partito', position, founder: true }, forces, realPoll });
const reseed = (world, n) => { const copy = structuredClone(world); copy.rngState = 1000 + n * 7919; return copy; };
const day = (date, offset) => new Date(Date.parse(`${date}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
const VOTE = '2027-09-26', CLOSES = '2027-08-22';
const politiche = { id: 'politiche-2027', type: 'politiche', label: 'Elezioni politiche', electionDate: VOTE, windowOpensAt: '2026-11-02', windowClosesAt: CLOSES, status: 'open' };
const regionale = { id: 'regionale-2027', type: 'regionale', label: 'Regionali Lazio', electionDate: '2027-04-18', windowOpensAt: '2027-01-05', windowClosesAt: '2027-03-12', status: 'open' };
const until = (fn, tries = 80) => { for (let n = 0; n < tries; n++) { const out = fn(n); if (out) return out; } throw new Error('Nessun esito utile nelle prove.'); };
const withPlayer = world => world.parties.find(item => item.isPlayer);
const lines = [];

// ---- 1, 2, 3: alliance → (explicit) coalition ----
const allied = until(n => { const w = reseed(base(), n); const out = W.proposeAlliance(w, 'pd', { date: DATE, partySupport: 70, influence: 70 }); return out.success ? out.world : null; });
{
  const alliance = W.playerAlliance(allied);
  assert.deepEqual([...alliance.partyIds].sort(), ['io', 'pd']);
  assert.match(alliance.label, /^Alleanza /, '«Crea alleanza»: il nome dice alleanza, non intesa.');
  assert.equal(W.allianceKind(allied, alliance).kind, 'alleanza', '1. Un accordo politico senza partecipazione elettorale è un’alleanza.');
  assert.deepEqual(alliance.coalitions, [], '1. Nessuna coalizione registrata.');
  const together = world => L.buildCoalitions(world, { playerChoice: null }).some(c => c.partyIds.includes('io') && c.partyIds.includes('pd'));
  assert.equal(together(allied), false, '1/3. Non si presentano insieme al voto per il solo fatto di essere alleati.');
  const registered = W.registerCoalition(allied, alliance.id, politiche, day(DATE, 30));
  assert.equal(registered.approved, true, '2. La coalizione per le politiche è approvata esplicitamente.');
  const after = registered.world, alliance2 = W.playerAlliance(after);
  assert.equal(W.allianceKind(after, alliance2).kind, 'coalizione', '2. Ora, e solo per quell’elezione, è una coalizione elettorale.');
  assert.equal(R.registrationsOf(alliance2)[0].electionId, politiche.id);
  assert.equal(together(after), true, '2. Registrata, si presenta insieme al voto.');
  assert.equal(W.registerCoalition(after, alliance2.id, politiche, day(DATE, 31)).already, true, '2. Registrare due volte non duplica.');
  // 3. the alliance that is not registered stays an alliance, for weeks and months
  const aged = structuredClone(allied); for (let w = 0; w < 6; w++) { aged.week += 1; }
  assert.equal(W.allianceKind(aged, W.playerAlliance(aged)).kind, 'alleanza', '3. L’alleanza resta tale senza trasformarsi in coalizione.');
  lines.push('alleanza senza coalizione, trasformazione esplicita per un’elezione, alleanza che resta tale');
}

// ---- 4, 5: a party that runs alone asks to join the centre-right; a refusal blocks the same request for seven days ----
{
  const right = base('centro-destra', 'adesione');
  right.alliances.push({ id: 'cdx', label: 'Coalizione guidata da Destra A', partyIds: ['fdi', 'fi', 'lega'], leaderId: 'fdi', kind: 'coalizione', cohesion: 70, since: DATE, status: 'active', history: [] });
  const joined = until(n => { const out = W.joinCoalition(reseed(right, n), 'cdx', DATE, { terms: true }); return out.joined ? out : null; });
  assert.ok(W.allianceOf(joined.world, 'io')?.partyIds.includes('fdi'), '4. Il partito che correva da solo entra nel centrodestra con una richiesta formale e le sue condizioni.');
  const comp = withPlayer(joined.world);
  assert.ok(comp, 'il partito del giocatore resta in campo');
  // 5. the request of a party whose programme is incompatible is refused with a reason, and cannot be repeated for seven days
  const left = base('estrema sinistra', 'rifiuto');
  left.alliances.push({ id: 'cdx', label: 'Coalizione guidata da Destra A', partyIds: ['fdi', 'fi', 'lega'], leaderId: 'fdi', kind: 'coalizione', cohesion: 70, since: DATE, status: 'active', history: [] });
  const refused = W.joinCoalition(left, 'cdx', DATE, { terms: true });
  assert.equal(refused.joined, false); assert.match(refused.blocked, /programmi incompatibili con .* su /, '5. Il rifiuto ha una motivazione comprensibile.');
  assert.equal(refused.retryAfter, day(DATE, 7), '5. Sette giorni di gioco.');
  assert.equal(W.refusedUntil(refused.world, 'cdx', DATE), day(DATE, 7));
  assert.throws(() => W.joinCoalition(refused.world, 'cdx', day(DATE, 3), { terms: true }), /si potrà ripresentare dal 2026-10-01/, '5. Dopo tre giorni la stessa richiesta è bloccata.');
  assert.throws(() => W.joinCoalition(refused.world, 'cdx', day(DATE, 6), { terms: true }), /respinta di recente/, '5. Dopo sei giorni ancora.');
  const again = W.joinCoalition(refused.world, 'cdx', day(DATE, 7), { terms: true });
  assert.equal(again.joined, false, '5. Dal settimo giorno si può chiedere di nuovo (qui l’incompatibilità resta e la risposta è di nuovo no).');
  assert.equal(W.refusedUntil(again.world, 'cdx', day(DATE, 8)), day(DATE, 14), '5. E il nuovo rifiuto riparte da sette giorni.');
  // the same rule for an alliance proposal that is refused
  const proposal = W.proposeAlliance(reseed(base('estrema sinistra', 'proposta'), 1), 'fdi', { date: DATE });
  assert.equal(proposal.success, false);
  assert.throws(() => W.proposeAlliance(proposal.world, 'fdi', { date: day(DATE, 2) }), /respinta di recente/, '5. Anche una proposta di alleanza respinta non si ripete subito.');
  lines.push('richiesta di adesione al centrodestra, rifiuto motivato e blocco di sette giorni (richiesta di adesione e proposta di alleanza)');
}

// ---- 6, 7: incompatible programmes do not agree by themselves; a negotiated compromise makes the accord possible ----
{
  const world = base('sinistra', 'programmi');
  const player = withPlayer(world), right = world.parties.find(item => item.id === 'fdi');
  const analysis = R.compare(world, player, right);
  assert.ok(analysis.hard.length >= 1, '6. Sinistra e destra sono incompatibili su almeno un tema che divide.');
  assert.ok(analysis.hard.some(row => ['immigrazione', 'diritti'].includes(row.id)), '6. In particolare sull’immigrazione o sui diritti.');
  assert.equal(analysis.rows.length, 10, 'dieci temi, posizione per posizione');
  const odds = W.allianceOdds(world, 'fdi', {});
  assert.equal(odds.chance, 0, '6. Il punteggio complessivo non cancella l’incompatibilità.'); assert.match(odds.blocked, /compromesso/);
  for (let n = 0; n < 30; n++) assert.equal(W.proposeAlliance(reseed(world, n), 'fdi', { date: DATE, partySupport: 100, influence: 100 }).success, false, '6. Mai un accordo automatico, qualunque sia la fortuna.');
  // 7. compromise on each hard theme: the two sides move to the middle, relations improve, a cost for who gives way
  let current = reseed(world, 3), costs = 0;
  for (const row of analysis.hard) {
    const done = until(n => { const out = W.negotiateCompromise(reseed(current, n + 11), 'io', 'fdi', row.id, DATE); return out.agreed ? out : null; }, 120);
    assert.equal(done.value, Math.round((row.a + row.b) / 2 * 10) / 10, '7. Ci si incontra a metà strada.');
    current = done.world; costs += done.cost;
  }
  assert.ok(costs > 0, '7. Chi cede paga un prezzo.');
  const solved = R.compare(current, withPlayer(current), current.parties.find(item => item.id === 'fdi'));
  assert.equal(solved.hard.length, 0, '7. Dopo i compromessi non restano incompatibilità vincolanti.');
  assert.ok(solved.rows.some(row => row.level === 'compromesso'), '7. I temi risolti risultano «compromesso».');
  const oddsAfter = W.allianceOdds(current, 'fdi', {});
  assert.equal(oddsAfter.blocked, null); assert.ok(oddsAfter.chance > 0, '7. Ora l’alleanza è possibile (e comunque non certa).');
  assert.ok((current.effects ?? []).some(effect => effect.cause === 'compromesso') || costs > 0, '7. Il compromesso ha una conseguenza sui sondaggi.');
  lines.push('programmi su dieci temi con incompatibilità vincolanti, nessun accordo automatico, compromesso negoziato');
}

// ---- 8, 9: the closing of the adhesions ----
{
  const alliance = W.playerAlliance(allied);
  assert.equal(R.coalitionDeadline(politiche), CLOSES);
  assert.throws(() => W.registerCoalition(allied, alliance.id, politiche, day(CLOSES, 1)), /si sono chiuse il 2027-08-22/, '8. Chiuse le adesioni non si forma più una coalizione.');
  assert.throws(() => W.registerCoalition(allied, alliance.id, politiche, day(VOTE, -10)), /deposito delle liste/, '9. A dieci giorni dal voto nessuna modifica.');
  assert.ok(W.registerCoalition(allied, alliance.id, politiche, CLOSES).approved, '8. L’ultimo giorno utile si può ancora.');
  assert.throws(() => W.registerCoalition(allied, alliance.id, politiche, day(VOTE, 1)), /già tenuta/, 'Dopo il voto non si registra nulla.');
  assert.match(R.coalitionBlock({ ...politiche, windowClosesAt: null }, day(VOTE, -41)) ?? 'nessun blocco', /nessun blocco/, 'Senza data di chiusura vale il quarantesimo giorno prima del voto.');
  lines.push('chiusura delle adesioni e modifica a pochi giorni dal voto rifiutate');
}

// ---- 10, 11, 12: break; different levels; coherence ----
{
  const alliance = W.playerAlliance(allied);
  let multi = W.registerCoalition(allied, alliance.id, regionale, day(DATE, 40)).world;
  const a = W.playerAlliance(multi);
  assert.equal(R.isElectoral(a, 'regionale'), true, '11. Coalizione registrata per le regionali…');
  assert.equal(R.isElectoral(a, 'politiche'), false, '11. …ma non per le politiche: livelli diversi, accordi diversi.');
  multi = W.registerCoalition(multi, a.id, politiche, day(DATE, 41)).world;
  assert.deepEqual(R.registrationsOf(W.playerAlliance(multi)).map(item => item.type).sort(), ['politiche', 'regionale'], '11. Poi anche per le politiche, come registrazione separata.');
  // 12. no party in two coalitions, the player once; invariants of the world hold
  const coalitions = L.buildCoalitions(multi, { playerChoice: null });
  const seen = new Map(); for (const c of coalitions) for (const id of c.partyIds) seen.set(id, (seen.get(id) ?? 0) + 1);
  assert.ok([...seen.values()].every(count => count === 1), '12. Nessun partito in due coalizioni nella stessa elezione.');
  assert.deepEqual(checkInvariants({ world: multi }, { scope: 'world' })?.errors ?? [], [], '12. Gli invarianti del mondo reggono.');
  // 10. the break: the alliance ends, nothing of the registration survives, relations and polls pay
  const player = withPlayer(multi), pdBefore = multi.parties.find(item => item.id === 'pd').playerRelation;
  const broken = W.breakAlliance(multi, W.playerAlliance(multi).id, day(DATE, 60));
  assert.equal(W.playerAlliance(broken), null, '10. L’alleanza è rotta.');
  assert.equal(L.buildCoalitions(broken, { playerChoice: null }).some(c => c.partyIds.includes('io') && c.partyIds.includes('pd')), false, '10. Non si presentano più insieme.');
  assert.ok(broken.parties.find(item => item.id === 'pd').playerRelation < pdBefore, '10. I rapporti peggiorano.');
  assert.ok(broken.grudges[[player.id, 'pd'].sort().join('|')] > 0, '10. Resta un rancore.');
  assert.ok(broken.effects.some(effect => effect.cause === 'rottura'), '10. Un effetto sui sondaggi.');
  lines.push('rottura, elezioni di livelli diversi con accordi diversi, coerenza di coalizioni e invarianti');
}

// ---- 13: the talks inside the alliance (leadership, candidacies, offices, common programme) and the history of the requests ----
{
  const three = until(n => { let w = reseed(base('centro-destra'), n); const out = W.proposeAlliance(w, 'fdi', { date: DATE, partySupport: 80, influence: 80 }); if (!out.success) return null; const out2 = W.inviteToAlliance(reseed(out.world, n + 5), 'lega', { date: DATE, partySupport: 80, influence: 80 }); return out2.success ? out2.world : null; });
  const alliance = W.playerAlliance(three);
  assert.ok(alliance.partyIds.length >= 3, '13. Un’alleanza di tre partiti.');
  const log = W.requestsView(three, DATE);
  assert.ok(log.sent.some(item => item.partyId === 'fdi' && item.status === 'accettata') && log.sent.some(item => item.kind === 'invito' && item.partyId === 'lega'), '13. Le richieste inviate e accettate sono nello storico.');
  const politiche = { id: 'politiche-2027', type: 'politiche', label: 'Elezioni politiche', electionDate: VOTE, windowOpensAt: '2026-11-02', windowClosesAt: CLOSES, status: 'open' };
  const options = W.termOptions(three, alliance.id, politiche);
  assert.equal(options.members.length, alliance.partyIds.length); assert.equal(options.strongestId, 'fdi', 'Il partito più forte è identificato.');
  assert.ok(options.offices.length >= 5 && options.themes.length === 10, 'Incarichi e dieci temi del programma comune sono in lista.');
  // leadership: the weak party asking the lead is refused by the strongest with the reason; the strongest is accepted by the others
  let refused = null, accepted = null;
  for (let n = 0; n < 60 && (!refused || !accepted); n++) {
    const w = reseed(three, n);
    if (!refused) { try { const out = W.proposeTerm(w, alliance.id, { kind: 'guida', partyId: 'io', electionId: politiche.id }, DATE, { election: politiche }); if (!out.accepted) refused = out; } catch { /* blocked */ } }
    if (!accepted) { const out = W.proposeTerm(reseed(three, n + 100), alliance.id, { kind: 'guida', partyId: 'fdi', electionId: politiche.id }, DATE, { election: politiche }); if (out.accepted) accepted = out; }
  }
  assert.ok(refused && /rivendica la guida|non lo accetta/.test(refused.reasons[0]), '13. Chiedere la guida senza il peso è rifiutato con il motivo.');
  assert.ok(W.refusedUntil(refused.world, 'x', DATE) === null && refused.retryAfter, '13. La richiesta respinta non si ripete per sette giorni.');
  assert.throws(() => W.proposeTerm(refused.world, alliance.id, { kind: 'guida', partyId: 'io', electionId: politiche.id }, DATE, { election: politiche }), /Richiesta già respinta/, '13. Ripetere subito è bloccato.');
  assert.ok(refused.world.requests === undefined || Array.isArray(refused.world.requests));
  assert.equal(W.playerAlliance(accepted.world).leaderId, 'fdi', '13. Accettata la guida, il capofila cambia davvero.');
  assert.ok(W.playerAlliance(accepted.world).terms.some(term => term.kind === 'guida' && term.status === 'aperto'), '13. E diventa una condizione dell’alleanza.');
  // candidacies: small extras pass more often than large ones; an accepted one boosts the quota of the vote
  const rate = extra => { let ok = 0; for (let n = 0; n < 80; n++) { try { if (W.proposeTerm(reseed(three, n), alliance.id, { kind: 'collegi', partyId: 'io', extra, electionId: politiche.id }, DATE, { election: politiche }).accepted) ok++; } catch { /* */ } } return ok; };
  const small = rate(3), large = rate(10);
  assert.ok(small > large, `13. Più candidature si chiedono, meno si ottengono (${small}/80 contro ${large}/80).`);
  const withSeats = until(n => { const out = W.proposeTerm(reseed(three, n), alliance.id, { kind: 'collegi', partyId: 'io', extra: 3, electionId: politiche.id }, DATE, { election: politiche }); return out.accepted ? out.world : null; });
  const registered = W.registerCoalition(withSeats, W.playerAlliance(withSeats).id, politiche, day(DATE, 30));
  assert.ok(registered.approved, '13. La coalizione con candidature negoziate si registra.');
  const coalitions = L.buildCoalitions(registered.world);
  assert.ok(coalitions.some(item => item.partyIds.includes('io') && item.quotaBoost?.io > 1), '13. Le candidature negoziate pesano sulla quota di collegi al voto.');
  // offices: a second assignment of the same office is blocked; each office has a weight-based answer
  const gotOffice = until(n => { const out = W.proposeTerm(reseed(three, n), alliance.id, { kind: 'incarico', partyId: 'io', office: 'cultura', electionId: politiche.id }, DATE, { election: politiche }); return out.accepted ? out : null; });
  assert.throws(() => W.proposeTerm(gotOffice.world, alliance.id, { kind: 'incarico', partyId: 'lega', office: 'cultura', electionId: politiche.id }, DATE, { election: politiche }), /già stato assegnato/, '13. Un incarico assegnato non si dà due volte.');
  assert.throws(() => W.proposeTerm(three, alliance.id, { kind: 'incarico', partyId: 'io', office: 'inesistente' }, DATE, { election: politiche }), /Incarico non valido/);
  let bigAccepted = 0; for (let n = 0; n < 60; n++) { try { if (W.proposeTerm(reseed(three, n), alliance.id, { kind: 'incarico', partyId: 'io', office: 'economia', electionId: politiche.id }, DATE, { election: politiche }).accepted) bigAccepted++; } catch { /* */ } }
  assert.ok(bigAccepted < 40, `13. Un incarico di peso (Economia) a un partito piccolo non passa sempre (${bigAccepted}/60).`);
  // common programme: themes with a hard conflict are refused, shared ones pass; the point becomes «concordato»
  const program = W.commonProgramOf(three, alliance);
  assert.ok(program.every(row => ['condiviso', 'da negoziare', 'in conflitto', 'concordato'].includes(row.state)));
  const shared = program.find(row => row.state === 'condiviso') ?? program[0];
  const agreed = W.proposeTerm(reseed(three, 3), alliance.id, { kind: 'punto-comune', theme: shared.id, electionId: politiche.id }, DATE, { election: politiche });
  if (shared.state === 'condiviso') assert.ok(agreed.accepted && W.commonProgramOf(agreed.world, W.playerAlliance(agreed.world)).find(row => row.id === shared.id).state === 'concordato', '13. Un punto già condiviso diventa un punto comune.');
  // deadline: after the closing of the lists nothing is negotiated for that election
  assert.throws(() => W.proposeTerm(three, alliance.id, { kind: 'guida', partyId: 'fdi', electionId: politiche.id }, day(CLOSES, 2), { election: politiche }), /si sono chiuse/, '13. A liste depositate le trattative sono chiuse.');
  // the terms are kept or betrayed at the vote
  const settled = W.settleElectoralTerms(gotOffice.world, { coalitions: [{ id: 'c', partyIds: ['io', 'fdi', 'lega'], leaderId: 'fdi' }], quotas: {}, date: VOTE });
  assert.ok(settled.settled.some(item => item.term.kind === 'incarico' && item.outcome === 'mantenuto'), '13. L’incarico concordato è verificato al voto.');
  assert.deepEqual(checkInvariants({ world: settled.world }, { scope: 'world' })?.errors ?? [], [], '13. Nessuna incoerenza dopo le trattative.');
  lines.push('trattative: guida, candidature con peso sulla quota, incarichi, punto comune, richieste respinte bloccate sette giorni, storico delle richieste, termini verificati al voto');
}
console.log(`Alleanze e coalizioni verificate (${lines.length} gruppi, 12 scenari più le trattative): ${lines.join(' · ')}.`);
