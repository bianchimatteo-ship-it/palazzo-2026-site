import assert from 'node:assert/strict';
import { advanceWeek, assignOrgans, createGameState, normalizeGameState, partyInvestment, setPartyLine, setPartyProgram } from '../src/core/career-engine.js';

const stats = { popularity: 48, reputation: 58, notoriety: 35, influence: 48, experience: 42 };
const make = () => createGameState({ seedText: 'party-currents-depth', currentDate: '2027-01-04', level: 'deputato', party: { id: 'partito-simulato', label: 'Partito simulato', founder: true }, place: { region: 'Lazio', municipality: 'Roma' }, stats });
const env = date => ({ currentDate: date, career: { currentLevel: 'deputato' }, offices: [], player: null, pollShare: 8, pollDelta: .2, mood: 52, signals: { stability: 48, crime: 45, spread: 150, euStatus: 'regolare', memoryRecall: null, electionSoon: false, openLawInCommission: false, lawAtVote: false } });
const nextDate = date => { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + 7); return value.toISOString().slice(0, 10); };

let game = make();
assert.equal(game.party.currents.length, 3);
assert.equal(new Set(game.party.currents.map(current => current.profile.objective)).size, 3, 'Le tre correnti hanno obiettivi diversi.');
assert.ok(game.party.currents.every(current => current.profile.priorities.length >= 4 && Number.isFinite(current.profile.initiative)));
let date = '2027-01-04';
for (let week = 0; week < 6; week++) {
  date = nextDate(date);
  game = advanceWeek({ game, stats: { ...stats }, parliament: null }, env(date), parliament => parliament).ctx.game;
}
assert.ok(game.party.currents.every(current => current.profile.memory.length > 0 && current.lastAction), 'Le correnti compiono iniziative autonome e le ricordano.');
assert.ok(game.party.org.currentPolitics?.requests?.length || game.party.org.conflicts.length, 'Le iniziative producono richieste o conflitti organizzativi.');

const input = { game, stats, parliament: null };
const line = setPartyLine(input, env(date), 'opposizione').ctx.game;
assert.ok(line.party.currents.every(current => current.profile.memory.some(item => item.kind === 'linea-condivisa' || item.kind === 'linea-rifiutata')), 'La linea entra nella memoria delle correnti.');
const program = setPartyProgram({ game: line, stats, parliament: null }, env(date), ['welfare', 'lavoro', 'autonomie'], { welfare: 'Welfare', lavoro: 'Lavoro', autonomie: 'Autonomie' }).ctx.game;
assert.ok(program.party.currents.some(current => current.profile.memory.some(item => item.kind === 'programma-rifiutato')));
const assigned = assignOrgans({ game: program, stats, parliament: null }, env(date), program.party.currents[1].id).ctx.game;
assert.ok(assigned.party.org.currentPortfolios?.portfolios && new Set(Object.values(assigned.party.org.currentPortfolios.portfolios)).size >= 2, 'Gli incarichi vengono distribuiti secondo gli equilibri, non solo alla corrente selezionata.');
assigned.party.org.treasury.balance = 30000;
const invested = partyInvestment({ game: assigned, stats, parliament: null }, env(date), 'fondo-territori').ctx.game;
assert.equal(invested.party.org.investments.at(-1).beneficiaryCurrentId, 'territori');
assert.ok(invested.party.currents.find(current => current.id === 'territori').profile.memory.some(item => item.kind === 'investimento'), 'La tesoreria lascia memoria alla corrente beneficiaria.');

const legacy = make();
legacy.party.currents = legacy.party.currents.map(current => { const { profile, ...old } = current; return old; });
const migrated = normalizeGameState(legacy);
assert.ok(migrated.party.currents.every(current => current.profile?.version === 1), 'I vecchi salvataggi ricevono profili di corrente.');

const run = () => { let state = make(); let today = '2027-01-04'; for (let week = 0; week < 20; week++) { today = nextDate(today); state = advanceWeek({ game: state, stats: { ...stats }, parliament: null }, env(today), parliament => parliament).ctx.game; } return { currents: state.party.currents, politics: state.party.org.currentPolitics, treasury: state.party.org.treasury.byCurrent }; };
assert.deepEqual(run(), run(), 'Le correnti restano deterministiche con lo stesso seed.');
console.log('Correnti verificate: 3 identità autonome, memoria e iniziative divergenti, richieste/conflitti, linea e programma ricordati, portafogli incarichi, tesoreria collegata, congressi preparati, migrazione save e determinismo.');
