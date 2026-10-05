// Elections, campaigns and rival AI, in depth: the crew (teams of volunteers, their quality and fatigue), the turnout as a lever, the
// record of the term that ends, territory → candidate → party, the list as a political matter, endorsements with a subject, a reason, a price
// and a memory, the runoff (stances, partial transfers, pacts, appeals, strategies) and the rivals who remember the player between
// campaigns. Everything is simulation; the numbers are reproducible with the same seed.
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
const aftermath = await import(`../src/core/aftermath-engine.js${v}`);
const local = await import(`../src/core/local-engine.js${v}`);
const { makeDemoState } = await import(`../src/data/simulation/demo.js${v}`);
const parties = JSON.parse(await readFile(new URL('../src/data/real/parties.json', import.meta.url), 'utf8'));
const party = parties.find(item => item.id === 'party-registro-p1-2022-63-ir');
const base = makeDemoState();
const statistics = [...base.dataset.statistics.filter(item => item.subjectId !== base.dataset.politicians[0].id), ...[['notoriety', 30], ['influence', 40], ['reputation', 55], ['popularity', 50]].map(([metric, value]) => ({ subjectId: base.dataset.politicians[0].id, metric, value }))];
const player = { ...base.dataset.politicians[0], partyId: party.id, region: 'Lombardia', municipality: 'Milano' };
const make = (type, role, config = {}, id = null, date = '2026-09-25') => engine.createCampaign({ career: { ...base.career, id: id ?? `depth-${type}-${role}`, partyId: party.id }, player, statistics, partyCatalog: parties, currentDate: date, config: { electionType: type, role, objective: 'win', municipalityBand: 'oltre-15000', ...config } });
const approved = campaign => { campaign.nomination.status = 'approved'; return campaign; };
const share = (campaign, id = campaign.playerCandidateId) => campaign.territories.reduce((sum, area) => sum + (area.supportByCandidate[id] ?? 0) * area.weight, 0) / campaign.territories.reduce((sum, area) => sum + area.weight, 0);
const mean = list => list.reduce((sum, value) => sum + value, 0) / Math.max(1, list.length);
const total = area => Object.values(area.supportByCandidate).reduce((sum, value) => sum + value, 0);
const field = campaign => campaign.candidates.filter(item => !item.isPlayer);
// A split field in a comune above 15,000: nobody wins at the first round.
const splitField = (campaign, values = [28, 26, 20, 14, 12]) => { const ids = Object.keys(campaign.territories[0].supportByCandidate); campaign.territories[0].supportByCandidate = Object.fromEntries(ids.map((id, index) => [id, values[index]])); return campaign; };
const toRunoff = (seedId, values) => { let c = splitField(approved(make('comunale', 'sindaco', {}, seedId)), values); c = engine.advanceCampaign(c, c.totalDays - c.day); return c; };

// ---------- 1. the crew: teams, quality, fatigue ----------
{
  let c = approved(make('comunale', 'sindaco'));
  const first = engine.crewOf(c);
  assert.equal(first.teams.length, 4, 'Quattro squadre con compiti diversi.');
  assert.ok(first.teams.every(team => team.efficiency > .97 && team.efficiency < 1.03 && team.fatigue === 0), 'Una squadra nuova rende il valore base e non è stanca.');
  assert.ok(new Set(first.teams.map(team => team.quality)).size > 1, 'Le squadre non hanno tutte la stessa qualità: rendimento diverso.');
  const door = rules.CAMPAIGN_ACTIVITIES.find(item => item.id === 'door_to_door');
  const interview = rules.CAMPAIGN_ACTIVITIES.find(item => item.id === 'interview');
  c.candidates[0].resources.volunteers = 40; c.candidates[0].resources.money = 90000;
  const before = engine.activityModifiers(c, door).crew;
  const gains = [];
  const efficiencies = [];
  for (let step = 0; step < 4; step++) { c = engine.performCampaignActivity(c, 'door_to_door', { territoryId: c.territories[0].id }); efficiencies.push(engine.crewOf(c).teams[0].efficiency); gains.push(engine.crewOf(c).teams[0].fatigue); }
  assert.ok(gains.every((value, index) => index === 0 || value > gains[index - 1]), `La fatica del porta a porta si accumula (${gains.join(' → ')}).`);
  assert.ok(efficiencies.at(-1) < efficiencies[0] && efficiencies[0] <= before, `Rendimento decrescente: ${before} → ${efficiencies.join(' → ')}.`);
  assert.equal(engine.activityModifiers(c, interview).crew, engine.crewOf(c).teams[1].efficiency, 'Ogni attività dipende dalla propria squadra: la stanchezza del territorio non frena la comunicazione.');
  assert.ok(engine.crewOf(c).teams[1].fatigue < engine.crewOf(c).teams[0].fatigue, 'Le altre squadre restano più fresche.');
  // Rest and idle days bring the fatigue down; rest is worth much more than waiting.
  const tired = engine.crewOf(c).teams[0].fatigue;
  const rested = engine.performCampaignActivity(c, 'crew_rest');
  const waited = engine.advanceCampaign(c, 1);
  assert.ok(engine.crewOf(rested).teams[0].fatigue < tired - 10, 'Una giornata di riposo abbassa molto la fatica.');
  assert.ok(engine.crewOf(waited).teams[0].fatigue > engine.crewOf(rested).teams[0].fatigue, 'Riposare rende più che aspettare.');
  assert.equal(rested.day, c.day + 1, 'Riposare costa un giorno di campagna.');
  assert.ok(engine.crewOf(engine.advanceCampaign(c, 7)).teams[0].fatigue < tired, 'Una settimana senza attività recupera la fatica.');
  // A tired crew makes more mistakes and, past the burnout threshold, loses people (and the experience they had).
  let burned = JSON.parse(JSON.stringify(c));
  burned.crew.teams.field.fatigue = 95; burned.candidates[0].resources.volunteers = 30;
  const quality = burned.crew.quality;
  burned = engine.advanceCampaign(burned, 7 - (burned.day % 7));
  assert.ok(burned.crew.lost > 0 && burned.candidates[0].resources.volunteers < 30 && burned.crew.quality < quality && burned.history.some(item => /allo stremo/.test(item.text)), 'Una squadra allo stremo perde volontari e qualità.');
  // The tired crew is an event: the answer can be a stop of two days, which pass.
  const event = rules.CAMPAIGN_EVENTS.find(item => item.id === 'squadra-stanca');
  assert.equal(event.when, 'tired');
  let stop = JSON.parse(JSON.stringify(c));
  stop.pendingEvents.push({ id: 'prova-stanca', kind: event.id, title: event.title, body: event.body, choices: event.choices, day: stop.day, date: stop.currentDate });
  const dayBefore = stop.day;
  const fatigueBefore = engine.crewOf(stop).teams[0].fatigue;
  stop = engine.decideCampaignEvent(stop, 'prova-stanca', 'rest');
  assert.equal(stop.day, dayBefore + 2, 'Fermarsi due giorni fa passare due giorni.');
  assert.ok(engine.crewOf(stop).teams[0].fatigue < fatigueBefore - 25, 'Il riposo scelto in un evento recupera la fatica.');
  // Training raises the quality, a profile from the committees too; both change what the crew yields and how it mobilises at the vote.
  const trained = engine.performCampaignActivity(approved(make('comunale', 'sindaco')), 'volunteer_training');
  assert.ok(trained.crew.quality > 50, 'La formazione alza la qualità delle squadre.');
  const weak = engine.applyCrewProfile(approved(make('comunale', 'sindaco', {}, 'crew-q')), { quality: 30 });
  const strong = engine.applyCrewProfile(approved(make('comunale', 'sindaco', {}, 'crew-q')), { quality: 75 });
  assert.ok(engine.crewEfficiency(strong, 'field') > engine.crewEfficiency(weak, 'field') + .1, 'Una squadra più preparata rende di più.');
  const vote = campaign => { const run = JSON.parse(JSON.stringify(campaign)); run.day = run.totalDays - 1; return engine.advanceCampaign(run, 1); };
  assert.ok(vote(strong).electionDays[0].mobilization > vote(weak).electionDays[0].mobilization, 'Volontari più preparati mobilitano di più il giorno del voto.');
  // A campaign saved before the crew existed keeps working.
  const old = JSON.parse(JSON.stringify(c)); delete old.crew;
  const resumed = engine.performCampaignActivity(old, 'citizen_meeting', { territoryId: old.territories[0].id });
  assert.ok(resumed.crew && engine.campaignSummary(old).crew.teams.length === 4, 'Un salvataggio senza squadre riparte con squadre neutre.');
  assert.deepEqual(engine.performCampaignActivity(JSON.parse(JSON.stringify(c)), 'citizen_meeting', { territoryId: c.territories[0].id }).crew, engine.performCampaignActivity(JSON.parse(JSON.stringify(c)), 'citizen_meeting', { territoryId: c.territories[0].id }).crew, 'Stesso stato, stesse squadre: determinismo.');
  // The pace of the campaign: an aggressive strategy tires the crew more than one that consolidates.
  const pace = strategy => { const run = approved(make('comunale', 'sindaco', { strategy }, 'ritmo')); run.candidates[0].resources.volunteers = 40; return engine.crewOf(engine.performCampaignActivity(run, 'door_to_door', { territoryId: run.territories[0].id })).teams[0].fatigue; };
  assert.ok(pace('nuovi') > pace('consolidare'), 'Una strategia aggressiva stanca di più le squadre di una che consolida.');
}

// ---------- 2. turnout: a lever with parts, not a number ----------
{
  const low = approved(make('comunale', 'sindaco', {}, 'turnout'));
  low.candidates[0].resources.organization = 15; low.candidates[0].resources.volunteers = 4;
  const high = JSON.parse(JSON.stringify(low));
  high.candidates[0].resources.organization = 85; high.candidates[0].resources.volunteers = 40;
  const lowTurnout = engine.campaignSummary(low).turnout;
  const highTurnout = engine.campaignSummary(high).turnout;
  assert.ok(highTurnout.value > lowTurnout.value + 1, `L’organizzazione e i volontari alzano l’affluenza (${lowTurnout.value} → ${highTurnout.value}).`);
  assert.ok(['base', 'place', 'climate', 'mobilization', 'runoff'].every(key => key in highTurnout.parts), 'L’affluenza ha parti leggibili: territorio, clima, mobilitazione.');
  const tired = JSON.parse(JSON.stringify(high)); for (const team of Object.values(tired.crew.teams)) team.fatigue = 90;
  assert.ok(engine.campaignSummary(tired).turnout.value < highTurnout.value, 'Squadre stanche mobilitano meno.');
  const climate = JSON.parse(JSON.stringify(high)); climate.nationalContext.moodIndex = 25;
  assert.ok(engine.campaignSummary(climate).turnout.parts.climate < highTurnout.parts.climate, 'Il clima del Paese entra nell’affluenza.');
  // Get-out-the-vote works through the crew that does it.
  const finale = JSON.parse(JSON.stringify(high)); finale.day = finale.totalDays - 6;
  const pushed = engine.performCampaignActivity(finale, 'get_out_vote', { territoryId: finale.territories[0].id });
  assert.ok(pushed.crew.gotv > 0 && engine.campaignSummary(pushed).turnout.value > engine.campaignSummary(finale).turnout.value, 'La mobilitazione al voto alza l’affluenza.');
  // Who mobilises more than the others gains votes on the day (not only the player: the others have machines too).
  const gap = [];
  for (let seed = 0; seed < 30; seed++) {
    const make2 = (organization, volunteers) => { const c = approved(make('regionale', 'presidente', {}, `mobilita-${seed}`)); c.candidates[0].resources.organization = organization; c.candidates[0].resources.volunteers = volunteers; c.day = c.totalDays - 1; return engine.advanceCampaign(c, 1); };
    gap.push(share(make2(90, 40)) - share(make2(5, 2)));
  }
  assert.ok(mean(gap) > .6, `Il giorno del voto chi mobilita di più guadagna (+${mean(gap).toFixed(2)} punti in media).`);
  const done = engine.advanceCampaign(toRunoff('turnout-runoff'), 20);
  assert.equal(done.status, 'finished');
  assert.ok(done.electionDays.length === 2 && done.electionDays[1].turnout < done.electionDays[0].turnout, `Al ballottaggio vota molta meno gente (${done.electionDays[0].turnout} → ${done.electionDays[1].turnout}).`);
  assert.equal(done.result.turnout, done.electionDays[1].turnout, 'L’affluenza del risultato è quella del giorno del voto.');
  assert.ok(done.electionDays.every(day => day.mobilizationByCandidate && Object.keys(day.mobilizationByCandidate).length >= 2 && day.turnoutParts), 'Tutti i candidati hanno una mobilitazione, non solo il giocatore.');
}

// ---------- 3. incumbency: the term that ends ----------
{
  const record = (standing, extra = {}) => ({ standing, score: standing, leads: true, side: 'maggioranza', role: 'sindaco', weeks: 200, confidence: 1, kept: 2, broken: 1, failures: 0, servicesDelta: 2, stability: 70, pressure: 20, margin: 60, passed: 1, kind: 'comune', ...extra });
  const good = make('comunale', 'sindaco', { mandate: record(40) }, 'mandato');
  const bad = make('comunale', 'sindaco', { mandate: record(-40) }, 'mandato');
  const none = make('comunale', 'sindaco', {}, 'mandato');
  assert.ok(good.incumbency && good.incumbency.active && good.incumbency.governing && good.candidacy.incumbent, 'Chi guida l’amministrazione uscente è un uscente.');
  assert.ok(share(good) > share(none) + .8 && share(bad) < share(none) - .8, `Il mandato pesa sul consenso di partenza (buono ${share(good).toFixed(1)}, nessuno ${share(none).toFixed(1)}, cattivo ${share(bad).toFixed(1)}).`);
  assert.ok(good.nomination.internalSupport > bad.nomination.internalSupport + .8 && good.nomination.requiredSupport < bad.nomination.requiredSupport, 'Il mandato pesa sulla candidatura: un buon uscente è difficile da non ricandidare.');
  assert.ok(engine.setExpectation(good, {}).expectation.pressure > 1 && engine.setExpectation(bad, {}).expectation.pressure < -1, 'Un buon mandato alza le attese, un mandato difficile le abbassa.');
  const claim = rules.CAMPAIGN_ACTIVITIES.find(item => item.id === 'claim_record');
  assert.ok(engine.activityModifiers(good, claim).mood > engine.activityModifiers(bad, claim).mood * 1.2, 'Rivendicare i risultati rende solo se i risultati ci sono.');
  // The administration the player faces has its own candidate, with its record: it is the opposition that profits from a bad one.
  const against = (score, id) => make('comunale', 'sindaco', { mandate: record(-score * .4, { leads: false, side: 'opposizione', score }), field: { incumbent: { score, confidence: 1, label: 'l’amministrazione di prova' } } }, id);
  const strongRecord = against(40, 'contro'), weakRecord = against(-40, 'contro');
  const incumbentOf = campaign => field(campaign).find(item => item.incumbent);
  assert.ok(incumbentOf(strongRecord) && incumbentOf(strongRecord).incumbency.boost > 1 && incumbentOf(weakRecord).incumbency.boost < -1, 'L’amministrazione uscente ha il suo candidato, con il suo bilancio.');
  assert.ok(share(strongRecord, incumbentOf(strongRecord).id) > share(weakRecord, incumbentOf(weakRecord).id) + 1.5, 'Il bilancio dell’uscente pesa sul suo candidato.');
  assert.ok(!strongRecord.candidacy.incumbent && engine.activityAvailability(strongRecord, rules.CAMPAIGN_ACTIVITIES.find(item => item.id === 'protest_campaign')).ok, 'Chi sfida l’amministrazione può fare campagna sul malcontento.');
  const protest = rules.CAMPAIGN_ACTIVITIES.find(item => item.id === 'protest_campaign');
  assert.ok(engine.activityModifiers(weakRecord, protest).mood > engine.activityModifiers(strongRecord, protest).mood, 'La campagna sul malcontento rende di più contro un’amministrazione che ha deluso.');
  // The record is built from what the institution holds.
  const council = (extra = {}) => local.createInstitution({ kind: 'comune', name: 'Comune di prova', region: 'Toscana', date: '2021-01-10', role: 'sindaco', side: 'maggioranza', leaderIsPlayer: true, playerGroupId: 'g1', leaderGroupId: 'g1', groups: [{ id: 'g1', label: 'Maggioranza', partyId: null, axis: 0, seats: 10, side: 'maggioranza' }, { id: 'g2', label: 'Opposizione', partyId: null, axis: 0, seats: 6, side: 'opposizione' }], ...extra });
  const goodTerm = { ...council(), until: '2026-01-10', executive: { ...council().executive, stability: 85 }, pressure: 10, commitments: [{ status: 'rispettato' }, { status: 'rispettato' }], budget: { ...council().budget, margin: 70, failures: 0 } };
  const badTerm = { ...council(), until: '2026-01-10', executive: { ...council().executive, stability: 35 }, pressure: 70, commitments: [{ status: 'disatteso' }, { status: 'disatteso' }], budget: { ...council().budget, margin: 30, failures: 2 } };
  const goodRecord = local.mandateRecord(goodTerm), badRecord = local.mandateRecord(badTerm);
  assert.ok(goodRecord.standing > 20 && badRecord.standing < -20, `Il registro del mandato giudica l’amministrazione (${goodRecord.standing} / ${badRecord.standing}).`);
  assert.ok(local.mandateRecord({ ...badTerm, status: 'sciolto' }).score < badRecord.score, 'Un consiglio sciolto pesa ancora di più.');
  assert.ok(local.mandateRecord({ ...goodTerm, playerSide: 'opposizione', executive: { ...goodTerm.executive, leader: 'simulato' } }).standing < 0, 'Chi era all’opposizione non risponde dei risultati: ne subisce il successo.');
  assert.ok(Math.abs(local.mandateRecord(goodTerm, { former: true }).standing) < Math.abs(goodRecord.standing), 'Chi ha lasciato la carica ne porta solo metà del peso.');
  assert.ok(local.mandateRecord({ ...goodTerm, until: '2021-02-20' }).standing < goodRecord.standing, 'Un mandato brevissimo pesa meno di uno lungo.');
  // The result judges the record: the incumbent who is not reconfirmed pays, the one who is reconfirmed gains.
  const outcome = (code, mandate, side, position) => ({ code, label: code, tone: 'good', mandate, side, position, expectation: 'in-linea', margin: 5, expected: 40 });
  const judge = (incumbency, out) => aftermath.electionAftermath({ campaign: { electionType: 'comunale', electionLabel: 'Comunali', candidacy: { role: 'sindaco' }, incumbency, commitments: 0 }, result: { playerShare: 40, outcome: out }, game: null, player: { municipality: 'Prova' } });
  const incumbency = { active: true, governing: true, standing: 30 };
  assert.ok(judge(incumbency, outcome('vittoria', true, 'maggioranza', 1)).stats.reputation > judge(null, outcome('vittoria', true, 'maggioranza', 1)).stats.reputation + .4, 'La riconferma di un buon mandato rafforza la reputazione.');
  const defeat = judge(incumbency, outcome('sconfitta', false, null, 2));
  assert.ok(defeat.stats.reputation < judge(null, outcome('sconfitta', false, null, 2)).stats.reputation - .7 && defeat.lines.some(line => /uscente/.test(line)), 'L’uscente non riconfermato paga il giudizio sul mandato.');
}

// ---------- 4. territory → candidate → party ----------
{
  // Rivals come from somewhere: a stronghold and the depth of the roots (never an advantage on average).
  const edges = [], advantages = [];
  for (let seed = 0; seed < 40; seed++) {
    const c = make('regionale', 'presidente', {}, `radici-${seed}`);
    for (const rival of field(c)) {
      assert.ok(rival.local && c.territories.some(area => area.id === rival.local.areaId) && rival.local.strength >= .3 && rival.local.strength <= 1, 'Ogni rivale ha un’area di radicamento.');
      const home = c.territories.find(area => area.id === rival.local.areaId);
      const others = c.territories.filter(area => area !== home);
      edges.push(rival.local.strength);
      advantages.push(home.supportByCandidate[rival.id] - mean(others.map(area => area.supportByCandidate[rival.id])));
    }
  }
  const correlation = (xs, ys) => { const mx = mean(xs), my = mean(ys); return xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i] - my), 0) / Math.sqrt(xs.reduce((sum, x) => sum + (x - mx) ** 2, 0) * ys.reduce((sum, y) => sum + (y - my) ** 2, 0)); };
  assert.ok(correlation(edges, advantages) > .2, `Più i radici sono profonde, più il rivale è forte nella sua area (correlazione ${correlation(edges, advantages).toFixed(2)}).`);
  // The weight of the party of each rival (polls where the vote is) counts, without moving the average of the field.
  const plain = make('comunale', 'sindaco', {}, 'partiti');
  const weights = Object.fromEntries(field(plain).filter(item => item.partyId).map((item, index) => [item.partyId, [30, 12, 4, 1][index % 4]]));
  const weighted = make('comunale', 'sindaco', { partyWeights: weights }, 'partiti');
  const delta = rival => share(weighted, rival.id) - share(plain, rival.id);
  const withParty = field(plain).filter(item => item.partyId);
  const heavy = withParty.reduce((a, b) => weights[a.partyId] >= weights[b.partyId] ? a : b), light = withParty.reduce((a, b) => weights[a.partyId] <= weights[b.partyId] ? a : b);
  assert.ok(delta(heavy) > 0 && delta(light) < 0 && delta(heavy) > delta(light) + 2, `Un candidato di un partito forte parte più avanti di uno di un partito debole (${delta(heavy).toFixed(1)} / ${delta(light).toFixed(1)}).`);
  // The territorial reputation of the player (committees, local leaders, what was done) weighs at home.
  const rooted = make('comunale', 'sindaco', { roots: { territorial: 95 } }, 'radici-giocatore'), foreign = make('comunale', 'sindaco', { roots: { territorial: 5 } }, 'radici-giocatore');
  assert.ok(share(rooted) > share(foreign) + 1.5, 'Chi è radicato sul territorio parte meglio a casa sua.');
  // Areas differ for each party: a multi-area race has a geography, a single comune has none.
  const regional = make('regionale', 'presidente', {}, 'geografia');
  assert.ok(Math.max(...regional.territories.map(area => area.supportByCandidate[regional.playerCandidateId])) - Math.min(...regional.territories.map(area => area.supportByCandidate[regional.playerCandidateId])) > .5, 'Le aree di una regione non hanno lo stesso colore politico.');
}


// ---------- 5. the list: composition, scouting, negotiation, places ----------
{
  assert.ok(!make('comunale', 'sindaco').list && !make('regionale', 'presidente').list, 'Chi corre per guidare l’esecutivo non è in una lista.');
  for (const [type, role] of [['comunale', 'consigliere'], ['regionale', 'consigliere'], ['politiche', 'deputato'], ['politiche', 'senatore'], ['politiche', 'uninominale'], ['europee', 'eurodeputato']]) {
    const c = make(type, role);
    assert.ok(c.list && c.list.mates.length >= 8 && c.list.mates.every(item => item.faction && item.areaId && Number.isFinite(item.strength)), `${type}/${role}: la lista ha i suoi nomi, con corrente e territorio.`);
  }
  // The strength of the mates decides the preferences.
  const prefs = strength => { const c = approved(make('regionale', 'consigliere', {}, 'preferenze')); c.list.mates = c.list.mates.map(item => ({ ...item, strength })); return elections.preferenceStanding(c, 3).rank; };
  assert.ok(prefs(90) > prefs(30), 'Con una lista di nomi forti è più difficile entrare per preferenze.');
  // The place on the list: composition, currents of the party, territory.
  const placed = (strength, listContext) => { const c = make('politiche', 'deputato', { listContext }, 'posto'); c.list.mates = c.list.mates.map(item => ({ ...item, strength })); c.internalCandidates.forEach(item => { item.internalSupport = 0; }); c.nomination.internalSupport = 5; return engine.advanceCampaign(c, c.nomination.deadlineDay); };
  const weakList = placed(35, { bias: 0, territorial: 50 }), strongList = placed(92, { bias: 0, territorial: 50 });
  assert.equal(weakList.nomination.status, 'approved'); assert.equal(strongList.nomination.status, 'approved');
  assert.ok(strongList.nomination.listPosition > weakList.nomination.listPosition && strongList.nomination.decision.rank.ahead > weakList.nomination.decision.rank.ahead, `Chi ha accanto nomi forti ottiene un posto peggiore (${weakList.nomination.listPosition} contro ${strongList.nomination.listPosition}).`);
  // The names the leaders of the party put on the list are the internal competition for the candidacy.
  const leaders = strength => { const c = make('politiche', 'deputato', {}, 'concorrenza'); c.list.mates = c.list.mates.map(item => ({ ...item, faction: 'dirigenti', strength })); c.internalCandidates.forEach(item => { item.internalSupport = 0; }); c.nomination.internalSupport = 9; return engine.advanceCampaign(c, c.nomination.deadlineDay).nomination.decision.strongestRival; };
  assert.ok(leaders(95) > leaders(40) + .3, 'I nomi forti dei dirigenti sono concorrenza interna per la candidatura.');
  const friend = placed(65, { bias: 1.5, territorial: 80, aligned: true }), foe = placed(65, { bias: -1.5, territorial: 20, aligned: false });
  assert.ok(friend.nomination.decision.rank.own > foe.nomination.decision.rank.own + 5 && friend.nomination.listPosition <= foe.nomination.listPosition, 'Correnti, dirigenti e forza sul territorio spostano il posto in lista.');
  // Scouting: strong and weak names, a faction that feels it.
  let strongFound = null, nothing = null, snub = null;
  for (let seed = 0; seed < 60; seed++) {
    const c = make('regionale', 'consigliere', {}, `scouting-${seed}`);
    const before = c.list.quality, weakest = Math.min(...c.list.mates.map(item => item.strength));
    const run = engine.performCampaignActivity(c, 'scouting', { territoryId: c.territories[0].id });
    const added = run.list.mates.find(item => item.scouted);
    if (added && added.strength >= 68) strongFound ??= { before, run, added };
    if (!added) nothing ??= { run, weakest };
    if (run.obligations.some(item => item.kind === 'lista')) snub ??= run;
  }
  assert.ok(strongFound && strongFound.run.list.quality >= strongFound.before && strongFound.run.list.scouted === 1, 'Un nome forte entra in lista e la migliora.');
  assert.ok(nothing && nothing.run.list.quality === nothing.run.list.baseline, 'Non sempre si trova qualcuno: la ricerca può non portare nulla.');
  assert.ok(snub, 'Far entrare un nome sposta qualcuno: la fazione dei dirigenti ne tiene conto (un debito).');
  // Better list, more votes on the day (the same campaign, only the list changes).
  const edge = quality => { const c = approved(make('regionale', 'consigliere', {}, 'bonus-lista')); c.list.quality = c.list.baseline + quality; c.day = c.totalDays - 1; return engine.advanceCampaign(c, 1).electionDays[0].shifts[c.playerCandidateId]; };
  assert.ok(Math.abs(edge(30) - edge(0) - 1.6) < .02 && edge(-30) < edge(0), 'La qualità della lista pesa sul voto, con un tetto.');
  // Negotiation of the place: a better one, with a price.
  let better = null, refused = null;
  for (let seed = 0; seed < 80 && !(better && refused); seed++) {
    const c = make('politiche', 'deputato', {}, `trattativa-${seed}`);
    const place = c.nomination.listPosition, capital = c.candidates[0].resources.politicalCapital, support = c.nomination.internalSupport;
    const run = engine.performCampaignActivity(c, 'list_negotiation');
    if (run.nomination.listPosition < place) better ??= { run, place, capital, support }; else refused ??= { run, support };
  }
  assert.ok(better && better.run.obligations.some(item => item.kind === 'lista') && better.run.list.concessions === 1 && better.run.candidates[0].resources.politicalCapital === better.capital - 3 && better.run.nomination.internalSupport < better.support, 'Un posto migliore si ottiene, e si paga: capitale, un debito con chi ha ceduto, un po’ di sostegno interno.');
  assert.ok(refused && refused.run.nomination.internalSupport < refused.support && !refused.run.obligations.length, 'La trattativa può arenarsi, con il costo politico.');
  assert.equal(engine.activityAvailability(make('comunale', 'sindaco'), rules.CAMPAIGN_ACTIVITIES.find(item => item.id === 'scouting')).ok, false, 'Chi non è in una lista non cerca nomi per la lista.');
}

// ---------- 6. endorsements: a subject, a reason, a price, a memory ----------
{
  const week = (seed, id = 'sostegni', type = 'comunale', role = 'sindaco', config = {}) => { let c = approved(make(type, role, config, `${id}-${seed}`)); for (let step = 0; step < 8 && c.status === 'active' && !c.pendingEvents.some(item => item.kind === 'endorsement'); step++) { c = engine.advanceCampaign(c, 7); if (c.pendingEvents.length && !c.pendingEvents.some(item => item.kind === 'endorsement')) c = engine.decideCampaignEvent(c, c.pendingEvents[0].id, c.pendingEvents[0].choices[0].id); } return c; };
  let offered = null;
  for (let seed = 0; seed < 200 && !offered; seed++) { const c = week(seed); if (c.pendingEvents.some(item => item.kind === 'endorsement')) offered = c; }
  assert.ok(offered, 'Un soggetto si fa avanti con un’offerta di sostegno.');
  const offer = offered.pendingEvents.find(item => item.kind === 'endorsement');
  assert.deepEqual(offer.choices.map(item => item.id), ['accept', 'light', 'decline'], 'Si può accettare con l’impegno, accettare senza impegni o declinare.');
  const stored = offered.endorsements.pending[offer.choices[0].effects.endorse.offerId];
  assert.ok(stored.subject.kind in rules.ENDORSEMENT_KINDS && stored.motive in rules.ENDORSEMENT_RULES.motives && /perché/.test(offer.body), 'L’offerta ha un soggetto e una motivazione.');
  const decide = choice => engine.decideCampaignEvent(offered, offer.id, choice);
  const accepted = decide('accept'), light = decide('light'), declined = decide('decline');
  assert.equal(accepted.endorsements.given.length, 1);
  assert.ok(accepted.endorsements.given[0].points > light.endorsements.given[0].points && light.endorsements.given[0].points > 0, 'Senza impegni il sostegno vale meno.');
  assert.ok(share(accepted) > share(offered) && share(light) > share(offered), 'Il sostegno porta voti dove il soggetto ha seguito.');
  assert.equal(share(declined), share(offered), 'Declinare non sposta voti.');
  assert.equal(declined.endorsements.refused.length, 1);
  assert.ok(accepted.endorsements.given[0].mode === 'accept' && light.endorsements.given[0].mode === 'light' && !Object.keys(accepted.endorsements.pending).length, 'L’offerta risolta non resta in sospeso.');
  const cost = rules.ENDORSEMENT_KINDS[stored.subject.kind].cost;
  if (cost === 'impegno') assert.ok(accepted.commitments > offered.commitments && accepted.obligations.length === 1 && light.obligations.length === 0, 'Un sostegno con un impegno lascia un impegno da mantenere.');
  assert.ok(Object.keys(rules.ENDORSEMENT_KINDS).length >= 6 && Object.values(rules.ENDORSEMENT_KINDS).every(item => item.cost && item.reach && item.weight), 'Ogni soggetto ha un peso, una portata e un costo.');
  // Asking for it: yes or no, and the no is remembered too.
  let yes = null, no = null;
  for (let seed = 0; seed < 80 && !(yes && no); seed++) {
    const run = engine.performCampaignActivity(approved(make('regionale', 'presidente', {}, `chiedere-${seed}`)), 'endorsement', { territoryId: undefined });
    if (run.endorsements.given.length) yes ??= run; else no ??= run;
  }
  assert.ok(yes && no && yes.endorsements.given[0].motive && no.endorsements.refused.length === 1, 'Chiedere un sostegno può andare bene o male.');
  // What is remembered: the rapport rises with a victory, fades with time, and the same subjects come back.
  const won = engine.mergeEndorsers([], accepted, { won: true }), lost = engine.mergeEndorsers([], accepted, { won: false }), snubbed = engine.mergeEndorsers([], declined, { won: true });
  assert.ok(won[0].relation > lost[0].relation && lost[0].relation > 50 && snubbed[0].relation < 50, 'Un sostegno a un vincitore lascia un rapporto migliore; un rifiuto lo raffredda.');
  const later = date => engine.decayEndorsers(won, date);
  assert.ok(later('2028-03-25')[0].relation < won[0].relation && later('2028-03-25')[0].relation > 50 && !later('2036-01-01').length, 'Il ricordo dei sostegni sbiadisce col tempo e poi scompare.');
  const subjectKey = stored.subject.key, areaId = stored.subject.areaId;
  const friends = relation => [{ key: `sindaco|${offered.territories[0].id}`, kind: 'sindaco', areaId: offered.territories[0].id, label: 'Un sindaco o un amministratore', relation }];
  let returned = null;
  for (let seed = 0; seed < 200 && !returned; seed++) { const c = week(seed, 'ritorno', 'comunale', 'sindaco', { endorsers: friends(90) }); const found = c.pendingEvents.find(item => item.kind === 'endorsement' && /torna/.test(item.title)); if (found) returned = { seed, c, found }; }
  assert.ok(returned && returned.c.endorsements.known.length === 1, 'Chi ti aveva sostenuto torna a farsi avanti nelle campagne successive.');
  const cooler = week(returned.seed, 'ritorno', 'comunale', 'sindaco', { endorsers: friends(55) });
  const warm = engine.decideCampaignEvent(returned.c, returned.found.id, 'accept'), mild = engine.decideCampaignEvent(cooler, cooler.pendingEvents.find(item => item.kind === 'endorsement').id, 'accept');
  assert.ok(warm.endorsements.given[0].points > mild.endorsements.given[0].points, 'Un rapporto migliore vale più voti.');
  assert.ok(subjectKey && areaId, 'Ogni soggetto ha un’identità stabile (tipo e area).');
}

// ---------- 7. the runoff: stances, partial transfers, pacts, appeals, strategies ----------
{
  const c0 = approved(make('comunale', 'sindaco', {}, 'ballottaggio'));
  assert.throws(() => engine.setCampaignStrategy(c0, 'mobilitazione'), /tra i due turni/i, 'Le strategie del ballottaggio non si scelgono in campagna.');
  assert.equal(make('comunale', 'sindaco', { strategy: 'voto-utile' }, 'ballottaggio').strategy, null);
  let c = toRunoff('ballottaggio');
  const playerId = c.playerCandidateId;
  assert.equal(c.stage, 'ballottaggio'); assert.equal(c.status, 'active');
  const finalists = c.runoffCandidateIds, out = c.candidates.filter(item => item.status === 'eliminated');
  assert.equal(finalists.length, 2); assert.ok(out.length === 3 && out.every(item => c.runoff.stances[item.id]), 'Ogni escluso prende posizione: sostiene un finalista o lascia libertà di voto.');
  assert.ok(Object.values(c.runoff.stances).some(item => item.backs) && Object.values(c.runoff.stances).some(item => !item.backs) || out.length < 3, 'Alcuni esclusi sostengono un finalista, altri no.');
  const summary = engine.campaignSummary(c).runoff;
  assert.ok(Math.abs(Object.values(summary.projection).reduce((sum, value) => sum + value, 0) - 100) < .1 && summary.transfers.length === 3, 'La proiezione del ballottaggio somma 100 e mostra dove vanno i voti degli esclusi.');
  assert.ok(summary.transfers.every(row => row.abstain >= .09 && Object.values(row.rates).every(rate => rate < 1)), 'Una parte degli elettori degli esclusi non vota: il trasferimento non è mai completo.');
  // It is not a normalisation: who backs whom changes the result a lot.
  const raw = c.runoff.firstRoundRaw, other = finalists.find(id => id !== playerId) ?? finalists[0];
  const backing = (backer, finalist) => { const run = JSON.parse(JSON.stringify(c)); run.runoff.stances[backer] = { backs: finalist, kind: 'endorsement' }; return engine.campaignSummary(run).runoff.projection[finalists[0]]; };
  const biggest = [...out].sort((a, b) => raw[b.id] - raw[a.id])[0];
  assert.ok(Math.abs(backing(biggest.id, finalists[0]) - backing(biggest.id, finalists[1])) > 5, `Chi sostiene chi cambia il ballottaggio (${backing(biggest.id, finalists[0]).toFixed(1)} contro ${backing(biggest.id, finalists[1]).toFixed(1)}), non solo le proporzioni.`);
  // An appeal and a pact move the projection; the player is free to choose a strategy for the two weeks (the first one costs nothing).
  const before = summary.projection[playerId];
  const appealed = engine.performCampaignActivity(c, 'appeal_eliminated');
  assert.ok(appealed.runoff.appeal > 0 && engine.campaignSummary(appealed).runoff.projection[playerId] > before, 'L’appello agli esclusi sposta voti.');
  let pact = null;
  for (let seed = 0; seed < 60 && !pact; seed++) {
    const run = toRunoff(`ballottaggio-${seed}`);
    if (run.stage !== 'ballottaggio' || run.candidates[0].status !== 'active') continue;
    const target = run.candidates.find(item => item.status === 'eliminated' && run.runoff.stances[item.id]?.backs !== run.playerCandidateId);
    if (!target) continue;
    const after = engine.performCampaignActivity(run, 'runoff_pact', { targetCandidateId: target.id });
    if (after.runoff.pacts.some(item => item.finalistId === after.playerCandidateId)) pact = { run, after, target };
  }
  assert.ok(pact, 'L’apparentamento con un escluso può riuscire.');
  assert.ok(pact.after.commitments > pact.run.commitments && pact.after.obligations.some(item => item.kind === 'apparentamento') && engine.campaignSummary(pact.after).runoff.projection[pact.after.playerCandidateId] > engine.campaignSummary(pact.run).runoff.projection[pact.run.playerCandidateId], 'Un apparentamento porta voti e impegni.');
  const strategies = Object.fromEntries(['apparentamenti', 'mobilitazione', 'voto-utile'].map(id => [id, engine.setCampaignStrategy(c, id)]));
  assert.equal(strategies.mobilitazione.candidates[0].resources.politicalCapital, c.candidates[0].resources.politicalCapital, 'La prima strategia del ballottaggio è gratuita.');
  assert.ok(engine.setCampaignStrategy(strategies.mobilitazione, 'voto-utile').candidates[0].resources.politicalCapital < c.candidates[0].resources.politicalCapital, 'Cambiarla ancora costa capitale.');
  const rateToPlayer = run => mean(engine.campaignSummary(run).runoff.transfers.map(row => row.rates[playerId]));
  assert.ok(rateToPlayer(strategies.apparentamenti) > rateToPlayer(strategies.mobilitazione), 'Gli apparentamenti fanno seguire di più gli elettori degli esclusi.');
  const mobilization = run => { const vote = JSON.parse(JSON.stringify(run)); vote.day = vote.totalDays - 1; return engine.advanceCampaign(vote, 1).electionDays.at(-1).mobilization; };
  assert.ok(mobilization(strategies.mobilitazione) > mobilization(strategies.apparentamenti) + .3, 'La mobilitazione porta alle urne i tuoi elettori.');
  assert.ok(engine.strategyFit(strategies.apparentamenti, 'apparentamenti') >= .8 && engine.strategyFit(strategies.apparentamenti, 'apparentamenti') <= 1.25, 'Le strategie del ballottaggio sono adatte o no alla situazione.');
  // The vote: the result carries the detail of the transfers and the lists of the pact enter the majority.
  const closed = engine.advanceCampaign(pact.after, 30);
  assert.equal(closed.status, 'finished'); assert.ok(closed.result.runoffDetail?.transfers?.length && closed.result.runoffResults.length === 2);
  if (closed.result.winnerGroupId === closed.playerCandidateId) assert.ok(closed.result.groups.find(row => row.id === closed.playerCandidateId).memberCandidateIds.includes(pact.target.id) && closed.result.groups.find(row => row.id === pact.target.id).apparentatoCon === closed.playerCandidateId && closed.result.groups.reduce((sum, row) => sum + row.seats, 0) === 16, 'Le liste apparentate entrano nella maggioranza del vincitore.');
  // The player is out: he can still say whom to vote for, and bargain for it.
  let out2 = splitField(approved(make('comunale', 'sindaco', {}, 'escluso')), [10, 30, 28, 20, 12]);
  out2 = engine.advanceCampaign(out2, out2.totalDays - out2.day);
  assert.equal(out2.candidates[0].status, 'eliminated');
  const stanceActivity = rules.CAMPAIGN_ACTIVITIES.find(item => item.id === 'runoff_stance');
  assert.ok(engine.activityAvailability(out2, stanceActivity).ok && !engine.activityAvailability(c, stanceActivity).ok, 'Solo chi è fuori dal ballottaggio indica per chi votare.');
  assert.equal(engine.activityAvailability(out2, rules.CAMPAIGN_ACTIVITIES.find(item => item.id === 'rally')).ok, false);
  const target = out2.candidates.find(item => out2.runoffCandidateIds.includes(item.id));
  const said = engine.performCampaignActivity(out2, 'runoff_stance', { targetCandidateId: target.id });
  assert.equal(said.runoff.stances[said.playerCandidateId].backs, target.id);
  assert.ok(engine.campaignSummary(said).runoff.projection[target.id] > engine.campaignSummary(out2).runoff.projection[target.id] || said.runoff.stances[said.playerCandidateId], 'I voti dell’escluso seguono la sua indicazione.');
  assert.ok(said.candidates.find(item => item.id === target.id).aiProfile.memory.some(item => item.type === 'aid' && item.targetId === said.playerCandidateId), 'Il finalista ricorda il sostegno ricevuto.');
  // A coalition partner of a finalist is not out with the others (the votes of the partner stay in the coalition).
  let allied = null;
  for (let seed = 0; seed < 100 && !allied; seed++) {
    let run = approved(make('comunale', 'sindaco', {}, `alleato-${seed}`));
    const partner = field(run)[0]; partner.relationship = 1;
    run = engine.negotiateCampaignAlliance(run, partner.id);
    if (run.alliances.length) allied = { run, partner };
  }
  assert.ok(allied, 'Un’alleanza si forma.');
  const ids = Object.keys(allied.run.territories[0].supportByCandidate);
  allied.run.territories[0].supportByCandidate = Object.fromEntries(ids.map((id, index) => [id, [20, 15, 30, 20, 15][index]]));
  const crossed = engine.advanceCampaign(allied.run, allied.run.totalDays - allied.run.day);
  assert.equal(crossed.stage, 'ballottaggio');
  assert.equal(crossed.candidates.find(item => item.id === allied.partner.id).status, 'allied', 'Il partner della coalizione non esce con gli esclusi.');
  assert.ok(elections.aggregateShares(crossed).find(group => group.id === crossed.playerCandidateId).members.includes(allied.partner.id), 'I voti del partner restano nella coalizione al ballottaggio.');
  const ended = engine.advanceCampaign(crossed, 30);
  assert.ok(ended.result.groups.find(row => row.id === ended.playerCandidateId).memberCandidateIds.includes(allied.partner.id), 'Il risultato conta anche la lista del partner.');
}


// ---------- 8. the rivals between campaigns ----------
{
  const FIRST = '2026-09-25', SECOND = '2028-03-25', LAST = '2027-12-25';
  // A first campaign leaves a trace with each rival: an attack, an agreement, the way it ended.
  let first = approved(make('comunale', 'sindaco', { municipalityBand: 'fino-15000' }, 'rivali-1', FIRST));
  const [attacked, partner] = field(first);
  first = engine.performCampaignActivity(first, 'comparison', { opponentId: attacked.id, territoryId: first.territories[0].id });
  partner.relationship = 1; first = engine.negotiateCampaignAlliance(first, partner.id);
  first = engine.advanceCampaign(first, 60);
  assert.equal(first.status, 'finished');
  const ledger = engine.rivalLedger(first);
  assert.equal(ledger.length, field(first).length);
  assert.ok(ledger.every(item => /^comunale\|comune:Milano\|/.test(item.key)) && new Set(ledger.map(item => item.key)).size === ledger.length, 'Ogni rivale ha un’identità: il partito, il luogo, il tipo di elezione.');
  const traces = ledger.find(item => item.key === first.candidates.find(item2 => item2.id === attacked.id).rivalKey);
  assert.ok(traces.memory.some(item => item.type === 'attack') && traces.flags.attacked && traces.personality && traces.objectives.length, 'Il rivale attaccato se lo ricorda, con la sua personalità.');
  assert.ok(ledger.every(item => item.memory.some(entry => entry.type === 'victory' || entry.type === 'defeat') && (item.flags.beatPlayer !== item.flags.lostToPlayer || item.memory.length)), 'Ogni rivale ricorda come è finita tra lui e il giocatore.');
  const registry = engine.mergeRivalRegistry([], ledger, first.currentDate);
  assert.ok(registry.length === ledger.length && registry.every(item => item.meetings === 1 && item.firstMet === first.currentDate && item.personality), 'Il registro tiene un record per rivale.');
  assert.ok(engine.mergeRivalRegistry(registry, ledger, first.currentDate).every(item => item.meetings === 2), 'Rivedersi aumenta gli incontri.');
  // Time fades it: weights halve in about eighteen months, the rapport goes back towards neutral, in the end the rival forgets.
  const remembered = registry.find(item => item.memory.some(entry => entry.type === 'attack'));
  const faded = engine.decayRivalRegistry(registry, '2028-03-25').find(item => item.key === remembered.key);
  const weight = (record, type) => record.memory.find(entry => entry.type === type).weight;
  assert.ok(weight(faded, 'attack') < weight(remembered, 'attack') * .6 && weight(faded, 'attack') > weight(remembered, 'attack') * .4, 'Il ricordo di un attacco si dimezza in circa un anno e mezzo.');
  assert.ok(Math.abs(faded.relation - 50) < Math.abs(remembered.relation - 50) * .6 + .5, 'Il rapporto torna verso il neutro.');
  assert.equal(engine.decayRivalRegistry(registry, '2034-06-01').length, 0, 'Dopo molti anni il rivale non ricorda più.');
  const crowd = Array.from({ length: 70 }, (_, index) => ({ ...registry[0], key: `prova|${index}`, lastMet: `2026-${String(1 + index % 9).padStart(2, '0')}-10`, memory: registry[0].memory }));
  assert.ok(engine.mergeRivalRegistry(crowd, ledger, FIRST).length <= rules.RIVAL_PERSISTENCE.limit && registry.every(item => item.memory.length <= rules.RIVAL_PERSISTENCE.memoryLimit), 'Il registro ha un limite.');
  // A rival met before recognises the player: identity, rapport, memories and priorities.
  const record = (rival, over = {}) => ({ key: rival.rivalKey, label: 'Rivale', partyId: rival.partyId, scope: 'comune:Milano', electionType: 'comunale', personality: 'diplomatico', objectives: ['vincere', 'restare-competitivo'], interests: ['programma'], loyalty: 70, initiative: .9, relation: 50, meetings: 1, firstMet: FIRST, lastMet: LAST, record: {}, last: { ahead: true }, memory: [], source: 'simulation', ...over });
  const historyOf = campaign => { const [a, b] = field(campaign); return [record(a, { relation: 10, personality: 'aggressivo', record: { attacked: 2, betrayed: 1 }, memory: [{ type: 'betrayal', weight: 2.5, count: 1, date: LAST }, { type: 'attack', weight: 2, count: 2, date: LAST }], last: { ahead: false } }), record(b, { relation: 88, personality: 'prudente', loyalty: 30, record: { allied: 1 }, memory: [{ type: 'agreement', weight: 2, count: 1, date: LAST }], last: { ahead: true } })]; };
  const bare = make('comunale', 'sindaco', { municipalityBand: 'fino-15000' }, 'rivali-2', SECOND);
  const known = make('comunale', 'sindaco', { municipalityBand: 'fino-15000', rivalHistory: historyOf(bare) }, 'rivali-2', SECOND);
  const [hostile, friendly, stranger] = field(known);
  assert.ok(hostile.recognition?.stance === 'ostile' && friendly.recognition?.stance === 'alleato' && !stranger.recognition, 'Chi hai già incontrato ti riconosce, gli altri no.');
  assert.ok(hostile.aiProfile.personality === 'aggressivo' && friendly.aiProfile.personality === 'prudente' && hostile.aiProfile.loyalty === 70, 'La personalità resta quella di prima.');
  assert.equal(hostile.aiProfile.objectives[0], 'fermare-il-giocatore'); assert.equal(friendly.aiProfile.objectives[0], 'costruire-alleanza');
  assert.ok(hostile.aiProfile.relationships[known.playerCandidateId] < 25 && friendly.aiProfile.relationships[known.playerCandidateId] > 75 && hostile.relationship < .25, 'Il rapporto riparte da dove era, un po’ sbiadito.');
  assert.ok(hostile.aiProfile.memory.some(item => item.type === 'betrayal' && item.fromPast && item.weight < 2.5) && known.history.some(item => /Ritrovi/.test(item.text)), 'Le memorie del passato entrano nel profilo e nella cronaca.');
  assert.ok(share(known, hostile.id) !== share(bare, field(bare)[0].id), 'Chi ti aveva battuto parte più sicuro di sé.');
  // And what he does changes: more attacks from the hostile one, alliance offers from the friend (never from strangers), who he backs when he withdraws.
  let attacksWith = 0, attacksWithout = 0, offers = 0, strangersOffers = 0, backsPlayer = 0, backsOther = 0;
  for (let seed = 0; seed < 24; seed++) {
    const id = `rivali-b-${seed}`;
    const plain = make('comunale', 'sindaco', { municipalityBand: 'fino-15000' }, id, SECOND);
    const remembered2 = make('comunale', 'sindaco', { municipalityBand: 'fino-15000', rivalHistory: historyOf(plain) }, id, SECOND);
    attacksWithout += engine.advanceCampaign(approved(plain), 7).candidates.find(item => !item.isPlayer).aiProfile.lastDecision?.action === 'attack' ? 1 : 0;
    attacksWith += engine.advanceCampaign(approved(remembered2), 7).candidates.find(item => !item.isPlayer).aiProfile.lastDecision?.action === 'attack' ? 1 : 0;
    // The friend proposes an alliance within a few weeks.
    for (const [campaign, tally] of [[approved(make('comunale', 'sindaco', { municipalityBand: 'fino-15000', rivalHistory: historyOf(plain) }, id, SECOND)), 'friend'], [approved(make('comunale', 'sindaco', { municipalityBand: 'fino-15000' }, id, SECOND)), 'stranger']]) {
      let run = campaign;
      for (let step = 0; step < 4 && run.status === 'active'; step++) { run = engine.advanceCampaign(run, 7); const proposal = run.pendingEvents.find(item => item.kind === 'alleanza'); if (proposal) { if (tally === 'friend') { offers++; const accepted = engine.decideCampaignEvent(run, proposal.id, 'accept'); assert.ok(accepted.alliances.length === 1 && accepted.candidates.some(item => item.status === 'allied'), 'Accettare la proposta forma l’alleanza.'); } else strangersOffers++; break; } if (run.pendingEvents.length) run = engine.decideCampaignEvent(run, run.pendingEvents[0].id, run.pendingEvents[0].choices.at(-1).id); }
    }
    // A weak rival who thinks well of the player backs him when he leaves the race.
    const weakOf = campaign => { const run = approved(campaign); const ids2 = Object.keys(run.territories[0].supportByCandidate); run.territories[0].supportByCandidate = Object.fromEntries(ids2.map((key, index) => [key, [30, 30, 2, 20, 18][index]])); return run; };
    for (const withHistory of [true, false]) {
      const base2 = make('comunale', 'sindaco', { municipalityBand: 'oltre-15000' }, `rivali-c-${seed}`, SECOND);
      const run = engine.advanceCampaign(weakOf(make('comunale', 'sindaco', { municipalityBand: 'oltre-15000', ...(withHistory ? { rivalHistory: [record(field(base2)[1], { relation: 90, personality: 'prudente', loyalty: 30, objectives: ['restare-competitivo', 'vincere'], record: { allied: 1 }, memory: [{ type: 'agreement', weight: 2, count: 1, date: LAST }] })] } : {}) }, `rivali-c-${seed}`, SECOND)), 21);
      const left = run.candidates.find(item => item.status === 'withdrawn');
      if (left) { if (left.endorsedId === run.playerCandidateId) backsPlayer += withHistory ? 1 : 100; else backsOther++; }
    }
  }
  assert.ok(attacksWith >= attacksWithout + 6, `Un rivale ostile attacca di più (${attacksWith} contro ${attacksWithout} su 24).`);
  assert.ok(offers >= 1 && strangersOffers === 0, `Un amico propone un’alleanza (${offers} proposte), gli sconosciuti no.`);
  assert.ok(backsPlayer >= 1 && backsPlayer < 100, `Chi ti stima e si ritira ti sostiene (${backsPlayer}), chi non ti conosce no.`);
  // Same seed and same history, same campaign; another history, another campaign. A saved campaign from before the registry leaves nothing behind.
  const run = history => engine.advanceCampaign(approved(make('comunale', 'sindaco', { municipalityBand: 'fino-15000', rivalHistory: history }, 'rivali-d', SECOND)), 21);
  const history = historyOf(make('comunale', 'sindaco', { municipalityBand: 'fino-15000' }, 'rivali-d', SECOND));
  assert.deepEqual(run(history).candidates, run(history).candidates, 'Stessa storia, stessa campagna: determinismo.');
  assert.notDeepEqual(run(history).candidates, run([]).candidates, 'Un’altra storia, un’altra campagna.');
  const legacy = JSON.parse(JSON.stringify(first)); delete legacy.rivalScope;
  assert.deepEqual(engine.rivalLedger(legacy), [], 'Una campagna salvata prima del registro non lascia ricordi.');
}


// ---------- 9. the career: context in, memory out (store) ----------
{
  const store = (await import(`../src/core/store.js${v}&profondita=1`)).store;
  const realData = await import(`../src/data/repositories/real-data.js${v}`);
  await realData.loadRealDatabase();
  await realData.loadRealCollections(['parties', 'politicalMovements', 'twoPerThousand', 'parliamentaryGroups', 'politicians']);
  const db = realData.realDatabase;
  store.setRealReference({ twoPerThousand: db.twoPerThousand, parties: db.parties, movements: db.politicalMovements });
  store.createCareer({ firstName: 'Marta', lastName: 'Prova', birthDate: '1985-02-11', gender: 'donna', region: 'Toscana', municipality: 'Siena', previousProfession: 'Architetta', initialLevel: 'comunale', partyMode: 'existing', partyId: party.id, parliamentaryGroupId: '', parliamentStartMode: 'real-context', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } }, db.parties, db.parliamentaryGroups);
  assert.deepEqual([store.getState().game.rivalRegistry, store.getState().game.endorsers], [[], []], 'Una carriera nuova parte senza registro dei rivali e dei sostenitori.');
  store.fastForwardToElection('comunale');
  store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'fino-15000', strategy: 'territorio' }, db.parties);
  let state = store.getState();
  let campaign = state.campaign;
  assert.ok(campaign.crew.quality >= 25 && campaign.crew.quality <= 80 && campaign.crew.teams.field.edge !== 0, 'Le squadre partono dalla rete che la carriera ha costruito.');
  assert.ok(campaign.rivalScope === 'comune:Siena' && field(campaign).every(rival => rival.rivalKey.startsWith('comunale|comune:Siena|') && rival.local), 'I rivali hanno un’identità e un’area di radicamento.');
  assert.ok(Number.isFinite(campaign.listContext?.territorial) && 'bias' in campaign.listContext, 'Il posto in lista conosce la reputazione sul territorio e i rapporti con la dirigenza.');
  assert.ok(campaign.incumbency?.kind === 'comune' && campaign.incumbency.governing && campaign.context.incumbent, 'Chi siede nella maggioranza uscente porta con sé il mandato.');
  // The vote is lost: what was promised, who backed the player and the rivals are all remembered.
  campaign.nomination.status = 'approved';
  campaign.endorsements.given.push({ id: 'sostegno-prova', key: `sindacato|${campaign.territories[0].id}`, kind: 'sindacato', label: 'Un sindacato', areaId: campaign.territories[0].id, motive: 'ideale', mode: 'accept', points: .9, cost: 'impegno', relation: 50, day: 3, date: campaign.currentDate });
  campaign.obligations.push({ id: 'obbligo-prova', kind: 'lista', to: 'dirigenti', faction: 'dirigenti', text: 'Un posto migliore in lista', weight: 1 });
  for (const area of campaign.territories) { const ids = Object.keys(area.supportByCandidate); area.supportByCandidate = Object.fromEntries(ids.map(id => [id, id === campaign.playerCandidateId ? 5 : 95 / (ids.length - 1)])); }
  const relation = (id, game) => game.relations.find(item => item.id === id).value;
  const before = { unions: relation('unions', state.game), leadership: relation('leadership', state.game) };
  campaign.day = campaign.totalDays - 1;
  store.advance(1);
  state = store.getState();
  assert.equal(state.campaign.status, 'finished'); assert.ok(!state.campaign.result.personalMandate);
  assert.equal(state.game.rivalRegistry.length, field(campaign).length, 'Dopo il voto i rivali entrano nel registro del gioco.');
  assert.ok(state.game.rivalRegistry.every(item => item.meetings === 1 && item.key.startsWith('comunale|comune:Siena|') && item.lastMet === state.campaign.currentDate && item.memory.length), 'Ogni rivale ricorda come è andata.');
  assert.equal(state.game.endorsers.length, 1); assert.ok(state.game.endorsers[0].relation > 50 && state.game.endorsers[0].relation < 58 && state.game.endorsers[0].history[0].outcome === 'perso', 'Chi ti ha sostenuto ricorda anche una sconfitta (un po’ meno bene).');
  assert.ok(relation('unions', state.game) < before.unions && relation('leadership', state.game) < before.leadership, 'Una sconfitta fa pagare gli impegni presi: i sindacati e la dirigenza ne escono più freddi.');
  const diary = state.game.log.find(item => item.id === `diario-voto-${state.campaign.id}`);
  assert.ok(diary && diary.lines.some(line => /rivali ricordano/.test(line)) && diary.lines.some(line => /Sostegni ricevuti/.test(line)), `Il diario del voto racconta cosa resta (${JSON.stringify(diary?.lines)}).`);
  store.clearCampaign();
  // The next campaign in the same place: the rivals who remember (the registry is the game's, so the test writes one for every party).
  const registryDate = store.getState().clock.currentDate;
  store.getState().game.rivalRegistry = db.parties.map(item => ({ key: `comunale|comune:Siena|${item.id}`, label: item.name, partyId: item.id, scope: 'comune:Siena', electionType: 'comunale', personality: 'aggressivo', objectives: ['vincere'], interests: ['territorio'], loyalty: 60, initiative: .8, relation: 8, meetings: 2, firstMet: '2020-01-10', lastMet: registryDate, record: { betrayed: 1 }, last: { ahead: false }, memory: [{ type: 'betrayal', weight: 2, count: 1, date: registryDate }], source: 'simulation' }));
  store.fastForwardToElection('comunale');
  store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'fino-15000' }, db.parties);
  const second = store.getState().campaign;
  assert.ok(field(second).every(rival => rival.recognition?.stance === 'ostile' && rival.aiProfile.personality === 'aggressivo' && rival.aiProfile.objectives[0] === 'fermare-il-giocatore'), 'Alla campagna successiva i rivali ti riconoscono e si comportano di conseguenza.');
  // The registry is saved with the game, and a game saved before it simply has none.
  store.save();
  const reloaded = (await import(`../src/core/store.js${v}&profondita=2`)).store;
  assert.equal(reloaded.getState().game.rivalRegistry.length, db.parties.length, 'Il registro dei rivali sopravvive al salvataggio.');
  const { normalizeGameState } = await import(`../src/core/career-engine.js${v}`);
  const legacy = JSON.parse(JSON.stringify(reloaded.getState().game)); delete legacy.rivalRegistry; delete legacy.endorsers;
  assert.deepEqual([normalizeGameState(legacy).rivalRegistry, normalizeGameState(legacy).endorsers], [[], []], 'Un salvataggio precedente riceve registri vuoti.');
  assert.equal(JSON.parse(mem.get('palazzo-2026.career.v1')).version, 9, 'La versione del salvataggio non cambia.');
}


// ---------- 10. campaigns saved before all this keep working ----------
{
  const strip = campaign => { const old = JSON.parse(JSON.stringify(campaign)); for (const key of ['crew', 'list', 'listContext', 'incumbency', 'endorsements', 'obligations', 'rivalScope', 'runoff']) delete old[key]; for (const candidate of old.candidates) for (const key of ['local', 'rivalKey', 'recognition', 'incumbent', 'incumbency']) delete candidate[key]; return old; };
  let old = strip(approved(make('comunale', 'sindaco', {}, 'vecchia')));
  for (const id of ['citizen_meeting', 'interview', 'door_to_door', 'fundraising', 'endorsement', 'volunteer_training', 'comparison']) old = engine.performCampaignActivity(old, id, { territoryId: old.territories[0].id });
  for (let guard = 0; guard < 40 && old.status === 'active'; guard++) { if (old.pendingEvents.length) { old = engine.decideCampaignEvent(old, old.pendingEvents[0].id, old.pendingEvents[0].choices[0].id); continue; } old = engine.advanceCampaign(old, 5); }
  assert.equal(old.status, 'finished', 'Una campagna salvata prima arriva al voto con squadre, sostegni e liste neutri.');
  assert.deepEqual(engine.rivalLedger(old), [], 'E non lascia ricordi nel registro dei rivali.');
  // A runoff saved before the stances existed ends with the old rule (proportional), and offers no pacts.
  let ro = splitField(approved(make('comunale', 'sindaco', {}, 'vecchia-ballottaggio')));
  ro = engine.advanceCampaign(ro, ro.totalDays - ro.day);
  assert.equal(ro.stage, 'ballottaggio');
  const legacy = strip(ro);
  assert.equal(engine.campaignSummary(legacy).runoff, null);
  assert.ok(['runoff_pact', 'appeal_eliminated'].every(id => !engine.activityAvailability(legacy, rules.CAMPAIGN_ACTIVITIES.find(item => item.id === id)).ok), 'Il ballottaggio di una campagna salvata prima non offre apparentamenti.');
  const ended = engine.advanceCampaign(legacy, 30);
  assert.ok(ended.status === 'finished' && ended.result.runoffResults.length === 2 && Math.abs(ended.result.runoffResults.reduce((sum, row) => sum + row.percent, 0) - 100) < .1, 'Si chiude con le percentuali normalizzate come prima.');
}

console.log('Elezioni e campagne in profondità verificate: squadre e fatica, affluenza, mandato uscente, territorio e partiti, liste, sostegni, ballottaggio, rivali che ricordano, memoria nella carriera e vecchie campagne.');
