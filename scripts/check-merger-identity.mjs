// The identity of the party born from a merger: the four ways of naming it, initials, colours, logos (own / partner's / new / uploaded with a declaration of rights), chosen before the confirmation,
// really saved in the game (record of the party, political world, history) and never losing members, sections, currents or history. Only a party founded by the player changes identity.
import assert from 'node:assert/strict';
import { resolveMergerIdentity, initialsOf } from '../src/core/merger-identity.js';
const own = { label: 'Rotta Civica', abbreviation: 'RC', color: '#264d82', color2: '#f2c14e', logo: { kind: 'builder', shape: 'cerchio', symbol: 'freccia', secondary: '#f2c14e' } };
const partner = { id: 'p2', label: 'Futuro Verde (simulata n.3)', abbreviation: 'FV', color: '#2a9d8f', hasLogo: true };
// ---- the pure rules
assert.equal(resolveMergerIdentity(own, partner, { nameMode: 'own' }).label, 'Rotta Civica');
assert.equal(resolveMergerIdentity(own, partner, { nameMode: 'partner' }).label, 'Futuro Verde', 'Il nome del partner senza la nota tra parentesi.');
assert.equal(resolveMergerIdentity(own, partner, { nameMode: 'both' }).label, 'Rotta Civica – Futuro Verde');
assert.equal(resolveMergerIdentity(own, partner, { nameMode: 'custom', label: 'Alleanza Nuova' }).label, 'Alleanza Nuova');
assert.throws(() => resolveMergerIdentity(own, partner, { nameMode: 'custom', label: ' x ' }), /almeno tre caratteri/, 'Un nome personalizzato troppo corto è rifiutato.');
assert.equal(resolveMergerIdentity(own, partner, { nameMode: 'both' }).abbreviation, 'RCFV', 'La sigla dei due nomi unisce le due sigle.');
assert.equal(resolveMergerIdentity(own, partner, { nameMode: 'custom', label: 'Alleanza Nuova Civica' }).abbreviation, 'ANC', 'Per un nome nuovo la sigla è composta dalle iniziali.');
assert.equal(resolveMergerIdentity(own, partner, { nameMode: 'own', abbreviation: 'rcn' }).abbreviation, 'RCN', 'La sigla scelta dal giocatore vale e va in maiuscolo.');
assert.throws(() => resolveMergerIdentity(own, partner, { abbreviation: 'R' }), /due caratteri/);
const id1 = resolveMergerIdentity(own, partner, { color: '#aa3322', color2: 'rosso' });
assert.equal(id1.color, '#aa3322'); assert.equal(id1.color2, '#f2c14e', 'Un colore non valido torna al precedente.');
assert.equal(resolveMergerIdentity(own, partner, { logoMode: 'new', logoShape: 'scudo', logoSymbol: 'stella' }).logo.shape, 'scudo');
assert.equal(resolveMergerIdentity(own, partner, { logoMode: 'partner' }).logo.kind, 'ref', 'Il logo del partner è un riferimento, non una copia di un file di terzi.');
assert.throws(() => resolveMergerIdentity(own, { ...partner, hasLogo: false }, { logoMode: 'partner' }), /non ha un logo/);
assert.throws(() => resolveMergerIdentity(own, partner, { logoMode: 'upload' }), /diritti di utilizzo/, 'Il logo caricato richiede la dichiarazione dei diritti.');
assert.equal(resolveMergerIdentity(own, partner, { logoMode: 'upload', logoRights: true }).logo.kind, 'upload');
assert.equal(resolveMergerIdentity(own, partner, {}).logo.shape, 'cerchio', 'Senza scelte il logo resta il proprio.');
assert.equal(initialsOf('Futuro Verde (simulata n.3)'), 'FV');
// ---- in the game
const { startCareer, playWeek, seeded } = await import('./lib/long-run.mjs');
const { checkInvariants } = await import('../src/core/invariants.js');
const { DATA_SOURCES } = await import('../src/data/schema.js');
const run = await startCareer({ seed: 'fusione-identita', level: 'comunale' });
const s = run.store.getState();
s.game.party.affiliation = 'founder'; s.game.party.rank = 5; s.game.resources.politicalCapital = 80; s.game.party.org.treasury.balance = 50000;
const ownForce = s.world.parties.find(item => item.isPlayer);
let record = s.dataset.parties.find(item => item.id === s.career.partyId);
if (!record) { record = { id: s.career.partyId, name: s.game.party.label, officialName: s.game.party.label, foundedAt: '2020-01-01', status: 'attivo' }; s.dataset.parties.push(record); }
Object.assign(record, { source: DATA_SOURCES.USER, abbreviation: 'RC', color: '#264d82', color2: '#f2c14e', logo: { kind: 'builder', shape: 'cerchio', symbol: 'freccia', secondary: '#f2c14e' } });
const listed = new Set((s.world.polls.at(-1)?.results ?? []).map(row => row.partyId));
const near = s.world.parties.find(item => !item.isPlayer && item.active && listed.has(item.id) && item.baseline >= Math.max(0.5, ownForce.baseline * 0.3) && item.baseline <= ownForce.baseline * 1.8 + 1);
assert.ok(near, 'C’è una forza vicina.');
s.world.ties[[ownForce.id, near.id].sort().join('|')] = 70; near.axis = ownForce.axis;
const before = { members: s.game.party.org.members, sections: s.game.party.org.sections.length, currents: s.game.party.currents.length, history: s.game.party.history.length, label: s.game.party.label };
// a refused identity does not merge anything
assert.throws(() => run.store.mergeParty(near.id, { identity: { nameMode: 'custom', label: '' } }), /tre caratteri/);
assert.ok(run.store.getState().world.parties.find(item => item.id === near.id).active, 'Con un’identità non valida la fusione non avviene.');
assert.throws(() => run.store.mergeParty(near.id, { identity: { logoMode: 'upload' } }), /diritti/);
run.store.mergeParty(near.id, { identity: { nameMode: 'custom', label: 'Alleanza Nuova Civica', abbreviation: 'anc', color: '#aa3322', color2: '#eecc44', logoMode: 'new', logoShape: 'scudo', logoSymbol: 'stella' } });
const after = run.store.getState();
const rec = after.dataset.parties.find(item => item.id === after.career.partyId);
assert.equal(rec.name, 'Alleanza Nuova Civica'); assert.equal(rec.officialName, 'Alleanza Nuova Civica'); assert.equal(rec.abbreviation, 'ANC'); assert.equal(rec.color, '#aa3322'); assert.equal(rec.color2, '#eecc44');
assert.deepEqual([rec.logo.kind, rec.logo.shape, rec.logo.symbol], ['builder', 'scudo', 'stella'], 'Il nuovo logo è salvato nel partito.');
const force = after.world.parties.find(item => item.isPlayer);
assert.equal(force.label, 'Alleanza Nuova Civica', 'Nei sondaggi il partito ha il nuovo nome.'); assert.equal(force.abbreviation, 'ANC'); assert.equal(force.brandColor, '#aa3322');
assert.equal(after.game.party.label, 'Alleanza Nuova Civica', 'Anche la carriera usa il nuovo nome (menu, elezioni, risultati).');
assert.ok(!after.world.parties.find(item => item.id === near.id).active, 'Il partner è confluito.');
// nothing is lost, the history is kept
assert.ok(after.game.party.org.members > before.members, 'Gli iscritti si sommano.'); assert.ok(after.game.party.org.sections.length >= before.sections, 'Le sezioni restano.');
assert.equal(after.game.party.currents.length, before.currents + 1, 'Le correnti restano e ne nasce una nuova.'); assert.ok(after.game.party.history.length > before.history, 'La storia del partito si allunga, non si perde.');
assert.equal(rec.mergers.length, 1, 'La fusione è nello storico.');
assert.equal(rec.mergers[0].previous.label, before.label); assert.equal(rec.mergers[0].identity.label, 'Alleanza Nuova Civica'); assert.equal(run.store.mergerHistory().length, 1);
assert.ok(checkInvariants(after, run.context).ok, 'Stato coerente dopo la fusione con identità.');
// the identity survives weeks of play (polls, elections read the same record)
const decide = seeded('fusione-id|d'); for (let week = 0; week < 6; week++) playWeek({ ...run, decide });
const later = run.store.getState();
assert.equal(later.world.parties.find(item => item.isPlayer).label, 'Alleanza Nuova Civica', 'Dopo sei settimane il nome è quello scelto.');
// a player who is not the founder (an existing party): the identity is never changed
const run2 = await startCareer({ seed: 'fusione-identita-2', level: 'comunale' });
const s2 = run2.store.getState(); s2.game.party.affiliation = 'member'; s2.game.party.rank = 5; s2.game.resources.politicalCapital = 80; s2.game.party.org.treasury.balance = 50000;
const own2 = s2.world.parties.find(item => item.isPlayer); const labelBefore = own2.label;
const listed2 = new Set((s2.world.polls.at(-1)?.results ?? []).map(row => row.partyId));
const near2 = s2.world.parties.find(item => !item.isPlayer && item.active && listed2.has(item.id) && item.baseline >= Math.max(0.5, own2.baseline * 0.3) && item.baseline <= own2.baseline * 1.8 + 1);
s2.world.ties[[own2.id, near2.id].sort().join('|')] = 70; near2.axis = own2.axis;
run2.store.mergeParty(near2.id, { identity: { nameMode: 'custom', label: 'Nome Inventato', logoMode: 'new' } });
assert.equal(run2.store.getState().world.parties.find(item => item.isPlayer).label, labelBefore, 'Un partito esistente non cambia nome con la fusione.');
console.log('Identità della fusione verificata: quattro modi di scegliere il nome, sigla, colori, logo (proprio, del partner, nuovo, caricato con dichiarazione), salvataggio in partito, mondo e storico, nulla perso; un partito non fondato dal giocatore non cambia identità.');
