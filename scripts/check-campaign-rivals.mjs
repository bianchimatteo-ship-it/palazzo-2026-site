import assert from 'node:assert/strict';
import { createCampaign, performCampaignActivity, advanceCampaign, negotiateCampaignAlliance, breakCampaignAlliance } from '../src/core/campaign-engine.js';
import { makeDemoState } from '../src/data/simulation/demo.js';

const demo = makeDemoState();
const realParties = demo.dataset.parties.filter(item => item.source === 'real');
const party = realParties[0];
const player = { ...demo.dataset.politicians[0], partyId: party?.id ?? null, region: 'Lombardia', municipality: 'Milano' };
const baseInput = {
  career: { ...demo.career, id: 'rival-memory-check', partyId: party?.id ?? null },
  player,
  statistics: demo.dataset.statistics,
  offices: demo.dataset.offices,
  territories: demo.dataset.territories,
  partyCatalog: realParties,
  currentDate: '2026-09-23',
  config: { electionType: 'regionale', role: 'presidente', municipalityBand: 'oltre-15000' }
};
const make = () => {
  const campaign = createCampaign(baseInput);
  campaign.nomination.status = 'approved';
  return campaign;
};

const original = make();
const rivals = original.candidates.filter(item => !item.isPlayer);
assert.ok(rivals.length >= 3, 'Servono almeno tre rivali per il test di autonomia.');
assert.ok(rivals.every(rival => rival.aiProfile?.personality && Array.isArray(rival.aiProfile.objectives) && Array.isArray(rival.aiProfile.interests)));
assert.ok(rivals.every(rival => Number.isFinite(rival.aiProfile.loyalty) && Number.isFinite(rival.aiProfile.initiative) && Array.isArray(rival.aiProfile.memory)));
assert.ok(new Set(rivals.map(rival => rival.aiProfile.personality)).size >= 2, 'I profili dei rivali devono differenziarsi.');

// An explicit player attack is remembered by the target and persists in the returned campaign state.
const target = rivals[0];
let attacked = performCampaignActivity(original, 'comparison', { opponentId: target.id, territoryId: original.territories[0].id });
const attackedRival = attacked.candidates.find(item => item.id === target.id);
assert.ok(attackedRival.aiProfile.memory.some(item => item.type === 'attack' && item.targetId === attacked.playerCandidateId), 'Il rivale ricorda l’attacco del giocatore.');
assert.ok(attackedRival.aiProfile.relationships[attacked.playerCandidateId] < 50, 'L’attacco peggiora il rapporto persistente.');

// Same situation, different profiles and memories: the autonomous intent must diverge deterministically.
const hostile = make();
const diplomatic = JSON.parse(JSON.stringify(hostile));
const hostileRival = hostile.candidates.find(item => item.id === target.id);
const diplomaticRival = diplomatic.candidates.find(item => item.id === target.id);
hostileRival.aiProfile = { ...hostileRival.aiProfile, personality: 'aggressivo', objectives: ['fermare-il-giocatore'], initiative: 1, memory: [{ type: 'betrayal', targetId: hostile.playerCandidateId, day: 0, weight: 2 }], relationships: { ...hostileRival.aiProfile.relationships, [hostile.playerCandidateId]: 20 } };
diplomaticRival.aiProfile = { ...diplomaticRival.aiProfile, personality: 'diplomatico', objectives: ['costruire-alleanza'], initiative: 1, memory: [{ type: 'agreement', targetId: diplomatic.playerCandidateId, day: 0, weight: 2 }], relationships: { ...diplomaticRival.aiProfile.relationships, [diplomatic.playerCandidateId]: 90 } };
const hostileNext = advanceCampaign(hostile, 7);
const diplomaticNext = advanceCampaign(diplomatic, 7);
assert.notEqual(hostileNext.candidates.find(item => item.id === target.id).aiProfile.lastDecision.action, diplomaticNext.candidates.find(item => item.id === target.id).aiProfile.lastDecision.action, 'Profili e memorie diverse devono produrre iniziative diverse.');

// Agreements and their break are remembered as cooperation and betrayal.
let alliance = make();
const ally = alliance.candidates.find(item => !item.isPlayer);
ally.relationship = 1;
alliance = negotiateCampaignAlliance(alliance, ally.id);
assert.equal(alliance.alliances.length, 1, 'L’accordo simulato deve poter essere concluso.');
const allied = alliance.candidates.find(item => item.id === ally.id);
assert.ok(allied.aiProfile.memory.some(item => item.type === 'agreement' && item.targetId === alliance.playerCandidateId), 'L’accordo viene memorizzato dal rivale.');
alliance = breakCampaignAlliance(alliance, alliance.alliances[0].id);
const broken = alliance.candidates.find(item => item.id === ally.id);
assert.ok(broken.aiProfile.memory.some(item => item.type === 'betrayal' && item.targetId === alliance.playerCandidateId), 'La rottura viene ricordata come tradimento.');

// Old saved campaigns are upgraded lazily when the autonomous turn runs.
const legacy = make();
delete legacy.candidates.find(item => !item.isPlayer).aiProfile;
const upgraded = advanceCampaign(legacy, 7);
assert.ok(upgraded.candidates.filter(item => !item.isPlayer).every(item => item.aiProfile?.version === 1), 'I vecchi salvataggi ricevono il profilo IA al primo turno.');

// Identical seed and decisions remain identical, including the autonomous memory state.
const deterministicA = advanceCampaign(make(), 28);
const deterministicB = advanceCampaign(make(), 28);
assert.deepEqual(deterministicA.candidates, deterministicB.candidates, 'L’IA dei rivali resta deterministica con lo stesso seed.');
assert.deepEqual(deterministicA.territories, deterministicB.territories, 'Gli effetti territoriali restano deterministici.');

console.log(`Rivali campagne verificati: ${rivals.length} profili persistenti, personalità e obiettivi attivi, memoria di attacchi/accordi/rotture, iniziative divergenti e deterministiche, migrazione dei vecchi salvataggi.`);
