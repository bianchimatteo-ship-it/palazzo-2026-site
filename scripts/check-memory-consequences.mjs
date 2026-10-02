import assert from 'node:assert/strict';
import { addSituationEvent, advanceWeek, createGameState, normalizeGameState, remember, situation, resolveInboxItem } from '../src/core/career-engine.js';
import { CAREER_EVENTS } from '../src/data/simulation/career-rules.js';

const stats = { popularity: 48, reputation: 58, notoriety: 42, influence: 46, experience: 40 };
const parliament = {
  player: { groupId: 'g1', chamber: 'camera', politicianId: 'p' },
  government: { status: 'active', primeMinister: 'other', coalitionGroupIds: ['g1'], supportingGroupIds: [], ministers: [], stability: 50, partners: {} },
  chambers: { camera: { groups: [{ groupId: 'g1', simulatedSeats: 300 }] }, senato: { groups: [] } },
  relations: {}, laws: [], history: [], resources: { politicalCapital: 50 }, careerStanding: { partySupport: 50 }
};
const base = createGameState({ seedText: 'memory-consequence-depth', currentDate: '2027-01-04', level: 'deputato', party: { id: 'partito-prova', label: 'Partito di prova', founder: true }, place: { region: 'Lazio', municipality: 'Roma' }, stats });

const cleanSituation = situation({ game: base, stats, parliament }, { career: { currentLevel: 'deputato' } });
assert.equal(CAREER_EVENTS.find(item => item.id === 'fiducia-territorio').when(cleanSituation), false, 'Senza memoria negativa non si apre il richiamo alle promesse.');
for (let index = 0; index < 3; index++) remember(base, { kind: 'scandalo', text: `Decisione controversa ${index}`, weight: 1 });
const rememberedSituation = situation({ game: base, stats, parliament }, { career: { currentLevel: 'deputato' } });
assert.ok(rememberedSituation.signals.memoryPressure >= 2, 'La pressione della memoria entra nella situazione.');
assert.equal(CAREER_EVENTS.find(item => item.id === 'fiducia-territorio').when(rememberedSituation), true, 'La memoria negativa modifica l’eligibilità di un evento futuro.');

// A decision with a later outcome keeps its origin and becomes a visible consequence.
const queuedGame = addSituationEvent(base, 'campagna-stampa');
const queued = queuedGame.inbox.find(item => item.templateId === 'campagna-stampa');
assert.ok(queued, 'L’evento di partenza è disponibile.');
const resolved = resolveInboxItem({ game: queuedGame, stats: { ...stats }, parliament }, { currentDate: '2027-01-04', career: { currentLevel: 'deputato' }, offices: [], player: null }, queued.id, 'querela');
assert.ok(resolved.ctx.game.pending.some(item => item.origin === queued.title && item.causes.includes(queued.title)), 'La conseguenza differita conserva origine e causa.');
let state = resolved.ctx;
let date = '2027-01-04';
for (let week = 0; week < 7; week++) {
  const next = new Date(`${date}T12:00:00`); next.setDate(next.getDate() + 7); date = next.toISOString().slice(0, 10);
  state = advanceWeek(state, { currentDate: date, career: { currentLevel: 'deputato' }, offices: [], player: null, signals: {} }, parliament => parliament).ctx;
}
assert.ok(state.game.log.some(item => item.kind === 'conseguenza' && item.lines?.some(line => line.startsWith('Da:'))), 'La conseguenza differita viene risolta e registrata.');

// Old saves receive causal metadata without changing their pending timing.
const legacy = normalizeGameState({ ...base, pending: [{ id: 'legacy-pending', dueWeek: 4, origin: 'Decisione precedente', label: 'Esito precedente', chance: 1, effects: { stats: { reputation: -1 } } }] });
assert.deepEqual(legacy.pending[0].causes, ['Decisione precedente']);
assert.equal(legacy.pending[0].dueWeek, 4);
assert.ok(CAREER_EVENTS.length >= 70 && new Set(CAREER_EVENTS.map(item => item.id)).size === CAREER_EVENTS.length, 'Il pool eventi è ampio e senza duplicati.');

console.log(`Memoria/conseguenze verificate: pressione storica, evento condizionato dalla memoria, catena differita con origine/causa, migrazione save legacy e ${CAREER_EVENTS.length} eventi unici.`);
