// The President of the Republic and the parties, and the days of the Quirinale.
//   - during the term nobody can join a party: the rule is in the real `joinParty()` of the engine and of the store (not only in the interface), with the reason that explains it;
//   - a career saved in an incoherent state (President and still a member of a party) is mended on loading: the membership ends with a line on record, the history stays in `pastParties`;
//   - the Home shows the activities of the role (the Quirinale ones), not a wall of blocked party activities, and the new institutional days have their own requirements, costs, waits and consequences.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const careerEngine = await import(`../src/core/career-engine.js${v}`);
const rules = await import(`../src/data/simulation/presidency-rules.js${v}`);
const gameMode = await import(`../src/ui/game-mode.js${v}`);

// ---------- 1. the President cannot join a party ----------
const run = await startCareer({ seed: 'quirinale-iscrizione', level: 'deputato', draft: { startingOffice: 'presidenteRepubblica', partyMode: 'independent', partyId: null, birthDate: '1960-03-04', startingRole: null } });
const { store, db } = run;
const st = () => store.getState();
const edit = change => { const save = JSON.parse(store.exportSave()); change(save); store.loadGame(save); };
assert.equal(st().career.currentLevel, 'presidente');
assert.ok(st().game.flags.president, 'Il giocatore è Presidente della Repubblica.');
assert.ok(!st().game.party, 'Il Presidente non ha un partito.');
const party = db.parties.find(item => item.source === 'real' && item.active !== false) ?? db.parties[0];
assert.throws(() => store.joinParty(party.id, db.parties), error => /Presidente della Repubblica non può aderire a un partito/.test(error.message) && /dopo la fine del mandato/.test(error.message), 'Lo store rifiuta l’adesione e spiega che sarà possibile dopo il mandato.');
assert.ok(!st().game.party && st().career.partyId !== party.id, 'Dopo il rifiuto nulla è cambiato.');
// the engine itself (not the store, not the interface)
assert.throws(() => careerEngine.joinParty({ game: st().game, stats: {}, parliament: st().parliament }, { currentDate: st().clock.currentDate }, { id: party.id, label: party.name }), error => error.message === careerEngine.PRESIDENT_JOIN_BAN, 'Il divieto è nella vera funzione joinParty().');
const home = gameMode.renderPartyPosition(st(), { parties: db.parties });
assert.ok(/non può aderire a un partito/.test(home) && !/data-party-action="join"/.test(home), 'L’interfaccia non offre il pulsante di adesione e dà la spiegazione.');

// ---------- 3. the days of the Quirinale ----------
const ids = rules.PRESIDENT_ACTIVITIES.map(item => item.id);
for (const id of ['visita-scuole', 'visita-ospedale', 'visita-lavoro', 'incontro-comunita', 'mediazione-crisi', 'messaggio-nazionale', 'delegazione-estera', 'iniziativa-culturale', 'messaggio', 'cerimonia']) assert.ok(ids.includes(id), `${id}: esiste tra le attività del Quirinale.`);
for (const activity of rules.PRESIDENT_ACTIVITIES) {
  assert.ok(activity.cost?.ap >= 1 && activity.cooldownWeeks >= 1 && activity.credit !== undefined, `${activity.id}: costo, attesa e conseguenza sono dichiarati.`);
  assert.ok(!/partito|segretario|premier|presidente del consiglio/i.test(activity.label), `${activity.id}: non è un’attività di partito o di governo.`);
}
const week = () => st().game.week.index;
const free = () => edit(save => { save.game.week.ap = 7; save.game.resources.politicalCapital = 30; });
free();
const credit0 = st().presidency.incumbent.credit;
// a mediation needs an open crisis: without one it is refused
edit(save => { Object.assign(save.parliament.government, { status: 'active', stability: 75 }); });
assert.throws(() => store.presidentActivity('mediazione-crisi'), /crisi/, 'Senza crisi la mediazione non si può fare.');
edit(save => { Object.assign(save.parliament.government, { status: 'crisis', stability: 30 }); });
store.presidentActivity('mediazione-crisi');
assert.ok(st().presidency.incumbent.ledger.some(item => item.act === 'mediazione-crisi' && item.kind === 'garanzia'), 'La mediazione apre un impegno verificato dopo qualche settimana.');
assert.ok(st().parliament.government.stability > 30, 'E sostiene la stabilità del governo.');
assert.throws(() => store.presidentActivity('mediazione-crisi'), /Si può ripetere/, 'Non si ripete subito.');
// a visit: region chosen, attention of the media goes there, cost paid once
free();
const days = st().game.week.ap, capital = st().game.resources.politicalCapital;
store.presidentActivity('visita-lavoro', 'Lombardia');
assert.equal(days - st().game.week.ap, 1, 'La visita costa un giorno.'); assert.equal(capital - st().game.resources.politicalCapital, 1, 'E un punto di capitale.');
assert.throws(() => store.presidentActivity('visita-lavoro', 'Lombardia'), /Si può ripetere/);
assert.throws(() => store.presidentActivity('visita-scuole', 'Atlantide'), /regione/, 'La regione deve essere una regione.');
store.presidentActivity('visita-scuole', 'Puglia'); store.presidentActivity('delegazione-estera');
assert.ok(st().presidency.incumbent.ledger.some(item => item.act === 'delegazione-estera' && item.kind === 'diplomazia'), 'Una delegazione estera lascia un impegno diplomatico.');
assert.ok(st().presidency.incumbent.credit > credit0, 'Le giornate istituzionali danno credito.');

// ---------- 4. the Home shows the activities of the role ----------
const text = gameMode.renderPlanner(st());
assert.ok(/data-presidency-action="activity"/.test(text) && /Visita a una scuola/.test(text), 'La Home mostra le attività del Quirinale.');
assert.ok(!/data-scene-activity=|data-game-activity=/.test(text), 'E non una fila di attività di partito bloccate.');
// (the store is one: the incoherent career comes last)
// ---------- 4. a career saved in an incoherent state ----------
const other = await startCareer({ seed: 'quirinale-incoerente', level: 'deputato', partyId: 'party-registro-p1-2019-51-ir', fast: true });
assert.ok(other.store.getState().game.party, 'La carriera di partenza ha un partito.');
const save = JSON.parse(other.store.exportSave());
const label = save.game.party.label;
save.game.flags = { ...save.game.flags, president: { since: save.clock.currentDate, termEnds: '2036-01-01' } };
const logBefore = save.game.log.length, pastBefore = (save.game.pastParties ?? []).length;
other.store.loadGame(save);
const loaded = other.store.getState().game;
assert.ok(loaded.flags.president, 'Il mandato resta.');
assert.equal(loaded.party, null, 'Il partito è lasciato al caricamento.');
assert.equal(loaded.pastParties.length, pastBefore + 1, 'La cronologia dei partiti è conservata (e si aggiunge il partito lasciato).');
assert.ok(/incompatibile con il mandato/.test(loaded.pastParties.at(-1).reason) && loaded.pastParties.at(-1).label === label);
assert.ok(loaded.log.some(item => /Lasci/.test(item.title)) && loaded.log.length >= Math.min(logBefore, 1), 'Una riga nel diario spiega il motivo.');
assert.ok(!loaded.relations.some(item => item.id === 'leadership'), 'Nessuna leadership di partito resta.');
assert.throws(() => other.store.joinParty('party-registro-p1-2014-04-ir', other.db.parties), /Presidente della Repubblica/, 'E anche qui non si può aderire.');
// after the term the door is open again
other.store.loadGame(JSON.parse(other.store.exportSave()));
const ex = JSON.parse(other.store.exportSave()); ex.game.flags = { ...ex.game.flags, president: null, exPresident: { since: ex.clock.currentDate, term: 1, reason: 'scadenza' } };
other.store.loadGame(ex);
assert.doesNotThrow(() => other.store.joinParty('party-registro-p1-2014-04-ir', other.db.parties), 'Finito il mandato l’adesione è di nuovo possibile.');

console.log('Presidente della Repubblica verificato: adesione vietata nella vera joinParty() (e nello store e nell’interfaccia) con la spiegazione, carriera incoerente sanata senza perdere la cronologia, adesione di nuovo possibile dopo il mandato, otto nuove giornate istituzionali con requisiti, costi, attese e verifiche, Home con le attività del ruolo.');
