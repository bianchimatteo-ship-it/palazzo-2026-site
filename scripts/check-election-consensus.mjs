// After a vote the percentage of that single competition goes to the electoral history; the personal consensus of the politician only moves toward it (slowly, by level), is never replaced by it, is
// not counted twice and survives saving and reloading. A council result does not crash the national party; a personal defeat above the polls is not a defeat of the party.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const KEY = 'palazzo-2026.career.v1';
const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(String(url).split('?')[0])), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const realData = await import(`../src/data/repositories/real-data.js${v}`);
await realData.loadRealDatabase();
await realData.loadRealCollections(['parties', 'politicalMovements', 'twoPerThousand', 'parliamentaryGroups', 'politicians']);
const db = realData.realDatabase;
const world = await import(`../src/core/world-engine.js${v}`);
const stat = (state, metric) => Number(state.dataset.statistics.find(item => item.subjectId === state.dataset.politicians.find(p => p.id === state.career.playerId)?.id && item.metric === metric)?.value ?? NaN);

async function season(tag, level, { win }) {
  mem.clear();
  const { store } = await import(`../src/core/store.js${v}&consenso=${tag}`);
  store.setRealReference({ twoPerThousand: db.twoPerThousand, parties: db.parties, movements: db.politicalMovements });
  const party = db.parties.find(item => item.id === 'party-registro-p1-2022-63-ir');
  store.createCareer({ firstName: 'Marta', lastName: 'Prova', birthDate: '1985-02-11', gender: 'donna', region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', previousProfession: 'Architetta', initialLevel: level, partyMode: 'existing', partyId: party.id, parliamentaryGroupId: '', parliamentStartMode: 'real-context', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } }, db.parties, db.parliamentaryGroups);
  store.fastForwardToElection(level);
  const role = { comunale: 'sindaco', provinciale: 'consigliere', regionale: 'consigliere' }[level];
  store.startCampaign({ electionType: level, role, objective: 'win', municipalityBand: 'fino-15000' }, db.parties);
  const campaign = store.getState().campaign;
  campaign.nomination.status = 'approved';
  for (const area of campaign.territories) { const ids = Object.keys(area.supportByCandidate); area.supportByCandidate = Object.fromEntries(ids.map(id => [id, id === campaign.playerCandidateId ? (win ? 70 : 5) : (win ? 30 : 95) / (ids.length - 1)])); }
  campaign.day = campaign.totalDays - 1;
  const before = { consensus: stat(store.getState(), 'consensus'), popularity: stat(store.getState(), 'popularity'), history: (store.getState().career.electionHistory ?? []).length };
  const partyBefore = store.getState().world?.parties?.find(item => item.isPlayer)?.support ?? null;
  store.advance(1);
  const state = store.getState();
  assert.equal(state.campaign.status, 'finished');
  return { store, state, before, share: state.campaign.result.playerShare, partyBefore };
}

for (const level of ['comunale', 'regionale']) {
  for (const win of [false, true]) {
    const label = `${level} ${win ? 'vittoria' : 'sconfitta'}`;
    const { store, state, before, share } = await season(`${level}-${win}`, level, { win });
    const after = stat(state, 'consensus');
    // the single competition is in the history, whole; the personal consensus is not that number
    const entry = state.career.electionHistory.at(-1);
    assert.equal(state.career.electionHistory.length, before.history + 1, `${label}: un solo record nello storico.`);
    assert.equal(entry.percent, share, `${label}: lo storico registra la percentuale della competizione (${share}).`);
    assert.notEqual(after, share, `${label}: il consenso personale non è stato sovrascritto con la percentuale del voto.`);
    // it moved toward the result, by a fraction
    const gap = share - before.consensus;
    assert.ok(Math.abs(after - before.consensus) < Math.abs(gap) * 0.5 + 0.5, `${label}: il consenso si sposta solo in parte (${before.consensus} → ${after}, voto ${share}).`);
    assert.ok(win ? after > before.consensus : after <= before.consensus + 0.5, `${label}: nella direzione giusta (${before.consensus} → ${after}).`);
    // the party in the world: no collapse because of one local result
    if (state.world) {
      const effects = (state.world.effects ?? []).filter(item => item.cause === 'carriera');
      assert.ok(effects.every(item => Math.abs(item.delta) <= ({ comunale: 0.15, provinciale: 0.25, regionale: 0.5 }[level] * 1.6 + 0.01)), `${label}: nessun effetto sproporzionato sul partito (${effects.map(item => item.delta).join(', ')}).`);
    }
    // no double update: more weeks do not move the consensus because of the same vote, and saving then reloading gives the same numbers
    store.advance(3);
    const later = stat(store.getState(), 'consensus');
    assert.ok(Math.abs(later - after) < 3, `${label}: nessun secondo aggiornamento dallo stesso voto (${after} → ${later}).`);
    store.save();
    const saved = JSON.parse(mem.get(KEY));
    const reloaded = (await import(`../src/core/store.js${v}&ricarica=${level}-${win}`)).store.getState();
    assert.equal(stat(reloaded, 'consensus'), stat(saved, 'consensus'), `${label}: il consenso dopo il ricaricamento è quello salvato.`);
    assert.equal(reloaded.career.electionHistory.length, saved.career.electionHistory.length, `${label}: lo storico non si duplica.`);
    assert.equal(reloaded.career.electionHistory.at(-1).percent, share, `${label}: la percentuale in archivio resta quella del voto.`);
  }
}

// the party reads the result by level and against its own polls (pure signal)
{
  const base = { parties: [{ id: 'p', isPlayer: true, active: true, label: 'Partito', support: 20, baseline: 20, anchor: 20, refSource: 'real' }], effects: [], events: [], week: 1, polls: [] };
  const effect = (electionType, share, mandate, pollShare) => {
    const out = world.applyWorldSignals(structuredClone(base), [{ type: 'election', electionType, label: 'Voto', share, mandate, pollShare }], '2026-10-01');
    return (out.effects ?? []).filter(item => item.cause === 'carriera').reduce((sum, item) => sum + item.delta, 0);
  };
  const comunale = effect('comunale', 8, false, 20), politiche = effect('politiche', 8, false, 20);
  assert.ok(Math.abs(comunale) < Math.abs(politiche) / 3, `Una sconfitta comunale pesa molto meno di una nazionale sul partito (${comunale} contro ${politiche}).`);
  assert.equal(effect('regionale', 22, false, 20), 0, 'Una sconfitta personale sopra i sondaggi non è una sconfitta del partito.');
  assert.ok(effect('regionale', 8, false, 20) < 0, 'Una sconfitta sotto i sondaggi pesa sul partito, in modo contenuto.');
}
console.log('Consenso dopo il voto verificato: la percentuale della competizione resta nello storico, il consenso personale si sposta solo in parte, senza doppi aggiornamenti e dopo il ricaricamento (comunale e regionale, vittoria e sconfitta); gli effetti sul partito dipendono dal livello e dai sondaggi.');
