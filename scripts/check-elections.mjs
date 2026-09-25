// Elections are not automatic: candidacy is decided by the party, the vote by the campaign, the context and a margin
// of uncertainty; results come in many shapes (victory, defeat, 2nd/3rd place, runoff, seat thanks to the list or the
// coalition, below the threshold, not enough preferences, lost district but elected in the proportional part) and
// leave consequences on the career. Campaigns differ from one another and no strategy is always the best.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const engine = await import(`../src/core/campaign-engine.js${v}`);
const elections = await import(`../src/core/election-engine.js${v}`);
const rules = await import(`../src/data/simulation/campaign-rules.js${v}`);
const { makeDemoState } = await import(`../src/data/simulation/demo.js${v}`);
const parties = JSON.parse(await readFile(new URL('../src/data/real/parties.json', import.meta.url), 'utf8'));
const party = parties.find(item => item.id === 'party-registro-p1-2022-63-ir');
const base = makeDemoState();

// A campaign played by a sensible player: the most useful available activity, events answered in turn.
function play({ type, role, strategy = null, seed, bias = 0, band = 'oltre-15000', listPosition = 2, notoriety = 30, reputation = 55, id = null }) {
  const player = { ...base.dataset.politicians[0], partyId: party.id, region: 'Lombardia', municipality: 'Milano' };
  const stats = [...base.dataset.statistics.filter(item => item.subjectId !== player.id), { subjectId: player.id, metric: 'notoriety', value: notoriety }, { subjectId: player.id, metric: 'influence', value: 40 }, { subjectId: player.id, metric: 'reputation', value: reputation }, { subjectId: player.id, metric: 'popularity', value: 50 }];
  let campaign = engine.createCampaign({ career: { ...base.career, id: id ?? `prova-${type}-${role}-${seed}`, partyId: party.id }, player, statistics: stats, partyCatalog: parties, currentDate: '2026-09-25', config: { electionType: type, role, objective: 'win', municipalityBand: band, strategy } });
  campaign.nomination.status = 'approved';
  campaign.candidacy.listPosition = campaign.nomination.listPosition = listPosition;
  if (bias) for (const area of campaign.territories) { const shares = area.supportByCandidate; shares[campaign.playerCandidateId] = Math.max(1, shares[campaign.playerCandidateId] + bias); const total = Object.values(shares).reduce((a, b) => a + b, 0); for (const key of Object.keys(shares)) shares[key] = shares[key] * 100 / total; }
  engine.setExpectation(campaign, {});
  for (let guard = 0; campaign.status === 'active' && guard < 220; guard++) {
    if (campaign.pendingEvents.length) { const event = campaign.pendingEvents[0]; campaign = engine.decideCampaignEvent(campaign, event.id, event.choices[(seed + guard) % event.choices.length].id); continue; }
    const options = engine.campaignActivities(campaign).filter(item => item.ok && item.activity.id !== 'debate_prep');
    if (!options.length || (seed + guard) % 7 === 0) { campaign = engine.advanceCampaign(campaign, 1); continue; }
    const score = item => item.expected - item.activity.risk * .004 + (item.activity.id === 'ally_meeting' ? .15 : 0) + (item.activity.category === 'resources' && campaign.candidates[0].resources.money < 3000 ? .3 : 0);
    options.sort((a, b) => score(b) - score(a));
    const pick = options[(seed * 31 + guard) % Math.min(5, options.length)];
    try { campaign = engine.performCampaignActivity(campaign, pick.activity.id, { territoryId: campaign.territories[(seed + guard) % campaign.territories.length].id, topicId: campaign.nationalContext.salientTopic }); }
    catch { campaign = engine.advanceCampaign(campaign, 1); }
  }
  return campaign;
}
const own = campaign => { const weight = campaign.territories.reduce((sum, area) => sum + area.weight, 0); return campaign.territories.reduce((sum, area) => sum + (area.supportByCandidate[campaign.playerCandidateId] ?? 0) * area.weight, 0) / weight; };
const count = (list, pick) => list.reduce((map, item) => { const key = pick(item); map[key] = (map[key] ?? 0) + 1; return map; }, {});

// ---------- 1. many ways to end, and expectations ----------
const codes = new Set();
const expectations = new Set();
const positions = new Set();
const scenarios = [['comunale', 'sindaco', {}], ['comunale', 'consigliere', { notoriety: 12 }], ['regionale', 'presidente', {}], ['regionale', 'consigliere', { notoriety: 12 }], ['politiche', 'deputato', { listPosition: 6 }], ['politiche', 'uninominale', { listPosition: 1 }], ['europee', 'eurodeputato', { notoriety: 10 }]];
for (const [type, role, extra] of scenarios) {
  for (let seed = 0; seed < 24; seed++) {
    const campaign = play({ type, role, seed, bias: (seed % 6 - 3) * 4, ...extra });
    assert.equal(campaign.status, 'finished', `${type}/${role}: la campagna arriva al voto`);
    const outcome = campaign.result.outcome;
    assert.ok(outcome && rules.OUTCOME_LABELS[outcome.code], `Esito classificato (${outcome?.code}).`);
    assert.ok(Number.isFinite(campaign.result.playerShare) && campaign.result.groups.every(row => Number.isFinite(row.percent) && Number.isFinite(row.seats)));
    codes.add(outcome.code); expectations.add(outcome.expectation); positions.add(outcome.position);
  }
}
for (const code of ['vittoria', 'sconfitta', 'eletto-opposizione', 'eletto-lista', 'posizione-lista', 'eletto-proporzionale']) assert.ok(codes.has(code), `Esito possibile: ${code} (visti: ${[...codes].join(', ')}).`);
assert.ok(codes.has('non-eletto') || codes.has('primo-non-eletto'), 'Con le preferenze si può restare fuori anche se la lista ha seggi.');
assert.ok(codes.has('ballottaggio-vinto') || codes.has('ballottaggio-perso'), 'Il ballottaggio decide alcuni comuni.');
assert.ok(codes.size >= 9, `Almeno 9 esiti diversi (${codes.size}).`);
assert.ok(expectations.has('sopra') && expectations.has('in-linea'), 'Risultati sopra e in linea con le attese.');
assert.ok(positions.has(2) && positions.has(3), 'Secondo e terzo posto sono esiti possibili.');

// ---------- 2. not automatic, but reproducible ----------
const close = seed => play({ type: 'comunale', role: 'sindaco', band: 'fino-15000', seed, bias: 2, id: `corsa-serrata-${seed}` });
const runs = Array.from({ length: 30 }, (_, seed) => close(seed));
const wins = runs.filter(item => item.result.outcome.code === 'vittoria').length;
assert.ok(wins > 0 && wins < 30, `Candidarsi non significa vincere: ${wins} vittorie su 30 corse serrate.`);
assert.deepEqual(close(3).result.groups.map(row => row.percent), close(3).result.groups.map(row => row.percent), 'Stessa campagna, stesso esito: la simulazione è riproducibile.');
assert.ok(runs.some(item => (item.electionDays?.[0]?.shifts ?? null)), 'Il giorno del voto sposta il risultato (indecisi, affluenza).');
const gains = runs.map(item => own(item) - item.expectation.share);
assert.ok(Math.max(...gains) < 12, `Nessuna campagna produce valanghe automatiche (massimo +${Math.max(...gains).toFixed(1)} punti).`);

// ---------- 3. runoff ----------
let runoffSeen = null;
for (let seed = 0; seed < 40 && !runoffSeen; seed++) {
  const campaign = play({ type: 'comunale', role: 'sindaco', band: 'oltre-15000', seed: seed + 50 });
  if (campaign.result.runoffResults?.length) runoffSeen = campaign;
}
assert.ok(runoffSeen, 'Nei comuni sopra i 15.000 abitanti si arriva al ballottaggio.');
assert.equal(runoffSeen.result.runoffResults.length, 2);
assert.ok(runoffSeen.result.groups.length >= 3 && runoffSeen.result.groups.some(row => row.candidateId === runoffSeen.playerCandidateId), 'Il risultato mostra tutte le liste del primo turno, anche chi non va al ballottaggio (compreso il giocatore).');
assert.ok(['ballottaggio-vinto', 'ballottaggio-perso', 'eletto-opposizione', 'sconfitta'].includes(runoffSeen.result.outcome.code));
assert.equal(runoffSeen.result.groups.reduce((sum, row) => sum + row.seats, 0), 16);

// ---------- 4. thresholds, closed lists, preferences, districts ----------
{
  const campaign = play({ type: 'europee', role: 'eurodeputato', seed: 1 });
  const rows = campaign.result.groups;
  assert.ok(rows.filter(row => row.percent < rules.EUROPEAN_THRESHOLD.percent).every(row => row.seats === 0), 'Sotto il 4% nessun seggio europeo.');
  let low = engine.createCampaign({ career: { ...base.career, id: 'soglia', partyId: party.id }, player: { ...base.dataset.politicians[0], partyId: party.id, region: 'Lombardia' }, statistics: base.dataset.statistics, partyCatalog: parties, currentDate: '2026-09-25', config: { electionType: 'politiche', role: 'deputato' } });
  low.nomination.status = 'approved'; low.candidacy.listPosition = 1;
  for (const area of low.territories) { const ids = Object.keys(area.supportByCandidate); area.supportByCandidate = Object.fromEntries(ids.map(id => [id, id === low.playerCandidateId ? 1 : 99 / (ids.length - 1)])); }
  low = engine.advanceCampaign(low, 80);
  assert.equal(low.result.outcome.code, 'sotto-soglia', 'Una lista sotto il 3% resta fuori dal Parlamento.');
  assert.equal(low.result.personalMandate, false);
  const places = [1, 6].map(listPosition => Array.from({ length: 16 }, (_, seed) => play({ type: 'politiche', role: 'deputato', seed: seed + 200, listPosition }).result.personalMandate).filter(Boolean).length);
  assert.ok(places[0] > places[1], `Nelle liste bloccate conta la posizione: capolista ${places[0]}/16, sesto posto ${places[1]}/16.`);
  const known = Array.from({ length: 16 }, (_, seed) => play({ type: 'regionale', role: 'consigliere', seed: seed + 300, notoriety: 75 }).result.personalMandate).filter(Boolean).length;
  const unknown = Array.from({ length: 16 }, (_, seed) => play({ type: 'regionale', role: 'consigliere', seed: seed + 300, notoriety: 5, reputation: 40 }).result.personalMandate).filter(Boolean).length;
  assert.ok(known >= unknown, `Con le preferenze conta il seguito personale (noto ${known}/16, sconosciuto ${unknown}/16).`);
}

// ---------- 5. campaigns differ: activities by election, phase, requirements; events ----------
{
  const europee = play({ type: 'europee', role: 'eurodeputato', seed: 5 });
  const probe = engine.createCampaign({ career: { ...base.career, id: 'sonda', partyId: party.id }, player: { ...base.dataset.politicians[0], partyId: party.id, region: 'Lazio' }, statistics: base.dataset.statistics, partyCatalog: parties, currentDate: '2026-09-25', config: { electionType: 'europee', role: 'eurodeputato' } });
  const ids = engine.campaignActivities(probe).map(item => item.activity.id);
  assert.ok(!ids.includes('territorial_pact'), 'L’accordo territoriale non esiste alle europee.');
  const gotv = rules.CAMPAIGN_ACTIVITIES.find(item => item.id === 'get_out_vote');
  assert.equal(engine.activityAvailability(probe, gotv).ok, false, 'La mobilitazione al voto è solo per gli ultimi giorni.');
  probe.day = probe.totalDays - 5;
  assert.equal(engine.activityAvailability(probe, gotv).ok, true, 'Nel rush finale la mobilitazione è disponibile.');
  const crisis = rules.CAMPAIGN_ACTIVITIES.find(item => item.id === 'crisis_response');
  assert.equal(engine.activityAvailability(probe, crisis).ok, false, 'Senza polemiche non c’è crisi da gestire.');
  probe.crisis = { title: 'prova', severity: 1, weeks: 0 };
  assert.equal(engine.activityAvailability(probe, crisis).ok, true);
  const door = rules.CAMPAIGN_ACTIVITIES.find(item => item.id === 'door_to_door');
  const local = engine.createCampaign({ career: { ...base.career, id: 'sonda-comune', partyId: party.id }, player: { ...base.dataset.politicians[0], partyId: party.id }, statistics: base.dataset.statistics, partyCatalog: parties, currentDate: '2026-09-25', config: { electionType: 'comunale', role: 'sindaco' } });
  assert.ok(engine.activityModifiers(local, door).type > engine.activityModifiers(probe, door).type, 'Il porta a porta rende di più in un comune che alle europee.');
  assert.ok(rules.CAMPAIGN_ACTIVITIES.length >= 30, `Molte azioni diverse (${rules.CAMPAIGN_ACTIVITIES.length}).`);
  for (const activity of rules.CAMPAIGN_ACTIVITIES) assert.ok(activity.days > 0 && activity.cost && Number.isFinite(activity.risk) && activity.detail, `Costi, tempo, rischio e descrizione: ${activity.id}`);
  assert.ok(europee.status === 'finished');
  const sequences = Array.from({ length: 10 }, (_, seed) => play({ type: 'regionale', role: 'presidente', seed: seed + 400 }).events.map(item => item.kind).join('>'));
  assert.ok(new Set(sequences).size >= 8, `Due campagne non sono mai uguali (${new Set(sequences).size}/10 sequenze di eventi diverse).`);
  const kinds = new Set(sequences.flatMap(item => item.split('>')).filter(Boolean));
  assert.ok(kinds.size >= 6, `Eventi e occasioni variabili (${kinds.size} tipi).`);
}

// ---------- 6. strategies: real effects, trade-offs, none always the best ----------
{
  const contexts = [['comunale', 'sindaco', 6], ['comunale', 'sindaco', -8], ['europee', 'eurodeputato', 0], ['regionale', 'presidente', -2], ['politiche', 'uninominale', -3]];
  const ids = Object.keys(rules.CAMPAIGN_STRATEGIES);
  const best = [];
  for (const [type, role, bias] of contexts) {
    const scores = ids.map(strategy => {
      let total = 0;
      for (let seed = 0; seed < 14; seed++) { const campaign = play({ type, role, strategy, seed: seed + 100, bias, listPosition: 1 }); total += own(campaign) - campaign.expectation.share + (['vittoria', 'ballottaggio-vinto'].includes(campaign.result.outcome.code) ? 1.5 : 0); }
      return [strategy, total / 14];
    }).sort((a, b) => b[1] - a[1]);
    best.push(scores[0][0]);
  }
  assert.ok(new Set(best).size >= 3, `Nessuna strategia è sempre la migliore (migliori per contesto: ${best.join(', ')}).`);
  const probe = engine.createCampaign({ career: { ...base.career, id: 'strategie', partyId: party.id }, player: { ...base.dataset.politicians[0], partyId: party.id }, statistics: base.dataset.statistics, partyCatalog: parties, currentDate: '2026-09-25', config: { electionType: 'comunale', role: 'sindaco', strategy: 'territorio' } });
  const door = rules.CAMPAIGN_ACTIVITIES.find(item => item.id === 'door_to_door');
  const interview = rules.CAMPAIGN_ACTIVITIES.find(item => item.id === 'interview');
  assert.ok(engine.activityModifiers(probe, door).strategy > engine.activityModifiers(probe, interview).strategy, 'Puntare sul territorio rafforza il porta a porta più delle interviste.');
  const switched = engine.setCampaignStrategy(probe, 'media');
  assert.ok(switched.candidates[0].resources.politicalCapital < probe.candidates[0].resources.politicalCapital && switched.candidateStats.reputation < probe.candidateStats.reputation, 'Cambiare strategia costa capitale e credibilità.');
  assert.throws(() => engine.setCampaignStrategy({ ...switched, day: switched.totalDays - 2 }, 'consolidare'), /ultimi cinque giorni/);
  assert.ok(rules.CAMPAIGN_STRATEGIES.nuovi.volatility > rules.CAMPAIGN_STRATEGIES.consolidare.volatility, 'Cercare nuovi elettori rende il risultato più incerto di consolidare.');
}

// ---------- 7. consequences on the career (store) ----------
{
  const store = (await import(`../src/core/store.js${v}&elezioni=1`)).store;
  const realData = await import(`../src/data/repositories/real-data.js${v}`);
  await realData.loadRealDatabase();
  await realData.loadRealCollections(['parties', 'politicalMovements', 'twoPerThousand', 'parliamentaryGroups', 'politicians']);
  const db = realData.realDatabase;
  store.setRealReference({ twoPerThousand: db.twoPerThousand, parties: db.parties, movements: db.politicalMovements });
  store.createCareer({ firstName: 'Marta', lastName: 'Prova', birthDate: '1985-02-11', gender: 'donna', region: 'Toscana', municipality: 'Siena', previousProfession: 'Architetta', initialLevel: 'comunale', partyMode: 'existing', partyId: party.id, parliamentaryGroupId: '', parliamentStartMode: 'real-context', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } }, db.parties, db.parliamentaryGroups);
  store.fastForwardToElection('comunale');
  store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'fino-15000', strategy: 'territorio' }, db.parties);
  let campaign = store.getState().campaign;
  assert.equal(campaign.strategy.id, 'territorio', 'La strategia scelta all’avvio accompagna la campagna.');
  assert.ok(campaign.expectation?.share > 0, 'La campagna parte con un’attesa dichiarata.');
  campaign.nomination.status = 'approved';
  for (const area of campaign.territories) { const ids = Object.keys(area.supportByCandidate); area.supportByCandidate = Object.fromEntries(ids.map(id => [id, id === campaign.playerCandidateId ? 5 : 95 / (ids.length - 1)])); }
  campaign.day = campaign.totalDays - 1;
  const supportBefore = store.getState().game.party.support;
  store.advance(1);
  let state = store.getState();
  assert.equal(state.campaign.status, 'finished');
  assert.equal(state.game.status, 'active', 'Una sconfitta non chiude la carriera.');
  const report = state.career.lastElectionReport;
  assert.ok(report && report.outcome.code && !report.personalMandate, 'Resoconto del voto conservato nella carriera.');
  for (const key of ['groups', 'territories', 'consequences']) assert.ok(report[key], `Resoconto: ${key}`);
  assert.ok(report.consequences.stats.reputation < 0 && report.consequences.party.support < 0, 'Una sconfitta costa reputazione e sostegno interno.');
  assert.ok(state.game.party.support < supportBefore, 'Il sostegno nel partito scende dopo la sconfitta.');
  const afterEvents = state.game.inbox.filter(item => ['dopo-voto-sconfitta', 'resa-dei-conti', 'ricorso-elettorale', 'capogruppo-opposizione'].includes(item.templateId));
  assert.ok(afterEvents.length, 'Il voto genera le prossime mosse in agenda.');
  store.advance(7);
  assert.ok(store.getState().game.inbox.some(item => afterEvents.some(event => event.id === item.id)) || store.getState().game.log.some(entry => /Dopo il voto/.test(entry.title)), 'Le mosse del dopo-voto non vengono decise in automatico nella stessa chiusura di settimana.');
  store.clearCampaign();
  assert.ok(store.getState().career.lastElectionReport, 'Il resoconto resta consultabile dopo aver chiuso la campagna.');

  // A victory: office, side, giunta to compose; never an automatic Government post.
  store.fastForwardToElection('comunale');
  store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'fino-15000', strategy: 'consolidare' }, db.parties);
  campaign = store.getState().campaign;
  campaign.nomination.status = 'approved';
  for (const area of campaign.territories) { const ids = Object.keys(area.supportByCandidate); area.supportByCandidate = Object.fromEntries(ids.map(id => [id, id === campaign.playerCandidateId ? 70 : 30 / (ids.length - 1)])); }
  campaign.day = campaign.totalDays - 1;
  store.advance(1);
  state = store.getState();
  assert.equal(state.campaign.result.outcome.code, 'vittoria');
  const mayor = state.dataset.offices.find(item => item.title === 'Sindaco' && !item.endDate);
  assert.ok(mayor && mayor.side === 'maggioranza', 'Il sindaco eletto guida la maggioranza.');
  assert.ok(state.game.inbox.some(item => item.templateId === 'giunta-composizione'), 'Da sindaco scegli la giunta.');
  assert.ok(!(state.parliament?.government?.ministers ?? []).some(item => item.playerAppointed), 'Vincere non assegna un incarico di governo.');
  assert.ok(state.career.electionHistory.length >= 2 && state.career.electionHistory.every(item => item.outcome), 'Lo storico elettorale registra gli esiti.');
}

// ---------- 8. interface: the electoral centre ----------
{
  const { renderElectionsHub, ELECTION_TABS } = await import(`../src/ui/elections-hub.js${v}`);
  const store = (await import(`../src/core/store.js${v}&elezioni=1`)).store;
  const state = store.getState();
  const clean = html => !/undefined|NaN|\[object Object\]/.test(html.replace(/data-[a-z-]+="[^"]*"/g, ''));
  for (const [tab] of ELECTION_TABS) {
    const html = renderElectionsHub(state, { parties, logoFor: () => null, tab });
    assert.ok(clean(html), `Centrale elettorale (${tab}): valori non validi`);
    assert.ok(html.includes('sx-hero') && html.includes('data-section-tab="elezioni"'), `Centrale elettorale (${tab}): intestazione e schede`);
  }
  const results = renderElectionsHub(state, { parties, logoFor: () => null, tab: 'risultati' });
  for (const text of ['Voti', 'Percentuale', 'Posizione', 'Seggi della lista', 'Affluenza', 'Attese e sondaggi', 'Dove hai preso i voti', 'Cosa cambia', 'Cosa succede ora']) assert.ok(results.includes(text), `Risultati: manca «${text}».`);
  const overview = renderElectionsHub(state, { parties, logoFor: () => null, tab: 'panoramica' });
  for (const text of ['Quando si vota', 'Il clima del voto', 'Quanto sei pronto', 'Come si assegnano i seggi']) assert.ok(overview.includes(text), `Panoramica: manca «${text}».`);
}

console.log(`Elezioni verificate: ${codes.size} esiti diversi (${[...codes].join(', ')}), attese sopra/in linea/sotto, posizioni fino al ${Math.max(...positions)}º posto; ${wins}/30 vittorie nelle corse serrate (mai automatiche, ma riproducibili); ballottaggio con tutte le liste del primo turno; soglie del 3% e del 4%, liste bloccate, preferenze e collegi con recupero nel proporzionale; campagne diverse per azioni (${rules.CAMPAIGN_ACTIVITIES.length}), fasi, requisiti ed eventi; strategie con compromessi e nessuna sempre vincente; conseguenze del voto sulla carriera, prossime mosse in agenda, nessun governo automatico; centrale elettorale con risultati completi.`);
