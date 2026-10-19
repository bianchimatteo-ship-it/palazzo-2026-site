// Le percentuali di una campagna sono quattro cose diverse e restano distinte: consenso territoriale (quota tra tutte le candidature, base simulata), sondaggio della fase
// (istituto, campione, margine), proiezione del ballottaggio (testa a testa) e risultato della fase che ha deciso. Verifica su più semi e tipi di elezione:
//  - ogni misura ha la sua etichetta e la sua fase (mai un sondaggio del primo turno durante il ballottaggio);
//  - il passaggio al ballottaggio non cambia il consenso territoriale oltre le oscillazioni reali: ciò che salta è la misura mostrata (e la storia lo dichiara);
//  - lo storico è etichettato per fase e l'andamento si legge dentro una sola fase;
//  - la proiezione dei finalisti fa 100, non dipende dall'ordine dei candidati e non favorisce il giocatore (chi era avanti vince più spesso di chi era dietro);
//  - la pagina mostra ogni percentuale con il suo nome.
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
const rules = await import(`../src/core/municipal-rules.js${v}`);
const { renderCampaignPage } = await import(`../src/ui/campaign-mode.js${v}`);
const { makeDemoState } = await import(`../src/data/simulation/demo.js${v}`);
rules.setMunicipalPopulationIndex(rules.indexMunicipalPopulation(JSON.parse(await readFile(new URL('../src/data/real/municipal-population.json', import.meta.url), 'utf8'))));
const parties = JSON.parse(await readFile(new URL('../src/data/real/parties.json', import.meta.url), 'utf8'));
const party = parties.find(item => item.id === 'party-registro-p1-2022-63-ir');
const base = makeDemoState();
const near = (a, b, eps, label) => assert.ok(Math.abs(a - b) <= eps, `${label}: ${a} vs ${b}`);

const TYPES = [
  { electionType: 'comunale', role: 'sindaco', municipalityBand: 'oltre-15000', place: { municipalityCode: '006003', region: 'Piemonte' }, seeds: 16 },
  { electionType: 'comunale', role: 'sindaco', municipalityBand: 'fino-15000', place: { municipalityCode: '001001', region: 'Piemonte' }, seeds: 4 },
  { electionType: 'regionale', role: 'presidente', place: { region: 'Toscana' }, seeds: 3 },
  { electionType: 'provinciale', role: 'presidente', place: { region: 'Toscana' }, seeds: 3 }
];
const start = (config, seed) => {
  const player = { ...base.dataset.politicians[0], partyId: party.id, region: config.place.region };
  const campaign = engine.createCampaign({ career: { ...base.career, id: `metrics-${config.electionType}-${seed}`, partyId: party.id }, player, statistics: base.dataset.statistics, partyCatalog: parties, currentDate: '2026-09-25', config: { objective: 'win', ...config } });
  campaign.nomination.status = 'approved';
  return campaign;
};
let runoffs = 0, finalists = 0, eliminated = 0, pages = 0, maxJump = 0;
for (const config of TYPES) for (let seed = 1; seed <= config.seeds; seed++) {
  let campaign = start(config, seed);
  const tag = `${config.electionType}/${config.municipalityBand ?? ''}/${seed}`;
  let projectionSeen = null;
  for (let guard = 0; campaign.status === 'active' && guard < 260; guard++) {
    if (campaign.pendingEvents.length) { const e = campaign.pendingEvents[0]; campaign = engine.decideCampaignEvent(campaign, e.id, e.choices[(seed + guard) % e.choices.length].id); continue; }
    const before = { stage: campaign.stage, territorial: engine.campaignMetrics(campaign).territorialConsensus.value };
    campaign = engine.advanceCampaign(campaign, 1);
    if (campaign.status !== 'active') break;
    const m = engine.campaignMetrics(campaign);
    // each measure has its stage
    assert.equal(m.stage, campaign.stage === 'ballottaggio' ? 'ballottaggio' : 'primo-turno', `${tag}: fase`);
    near(m.territorialConsensus.value, engine.campaignSummary(campaign).consensus, 0.05, `${tag}: il consenso territoriale è quello del riepilogo`);
    if (m.poll) assert.equal(m.poll.stage === 'ballottaggio', m.stage === 'ballottaggio', `${tag} giorno ${campaign.day}: un sondaggio di un'altra fase (${m.poll.stage}) durante ${m.stage}`);
    if (m.poll) assert.ok(Number.isFinite(m.poll.margin) && m.poll.sample > 0 && m.poll.institute, `${tag}: il sondaggio dichiara margine, campione e istituto`);
    assert.ok(m.history.every(item => (item.stage ?? 'campagna') === (m.stage === 'ballottaggio' ? 'ballottaggio' : 'campagna')), `${tag}: lo storico mostrato è di una sola fase`);
    assert.ok(campaign.consensusHistory.every(item => item.stage), `${tag}: ogni punto dello storico dichiara la sua fase`);
    if (m.stage === 'ballottaggio') {
      if (before.stage !== 'ballottaggio') {
        // the passage: the territorial base moves only as much as the real dynamics of one day; what jumps is the measure that is shown
        const jump = Math.abs(m.territorialConsensus.value - before.territorial);
        maxJump = Math.max(maxJump, jump);
        assert.ok(jump < 5, `${tag}: il consenso territoriale cambia di ${jump.toFixed(1)} punti nel passaggio al ballottaggio`);
        const last = campaign.consensusHistory.at(-1), prev = campaign.consensusHistory.at(-2);
        if (prev && prev.stage !== last.stage) assert.notEqual(prev.metric, last.metric, `${tag}: il salto di misura è dichiarato`);
      }
      const projection = engine.runoffProjection(campaign);
      if (projection) {
        const values = Object.values(projection);
        assert.equal(values.length, 2, `${tag}: la proiezione riguarda i due finalisti`);
        near(values.reduce((a, b) => a + b, 0), 100, 0.15, `${tag}: la proiezione fa 100`);
        assert.equal(m.runoffProjection.share, projection[campaign.playerCandidateId] ?? null, `${tag}: la proiezione mostrata è quella del motore`);
        assert.equal(m.runoffProjection.finalist, campaign.playerCandidateId in projection, `${tag}: la metrica dice se il giocatore è tra i finalisti`);
        if (!projectionSeen) {
          projectionSeen = projection;
          // the order of the candidates changes nothing
          const mirrored = { ...campaign, candidates: [...campaign.candidates].reverse() };
          const other = engine.runoffProjection(mirrored);
          for (const id of Object.keys(projection)) near(projection[id], other[id], 0.01, `${tag}: la proiezione non dipende dall'ordine dei candidati`);
        }
      } else assert.equal(m.runoffProjection, null, `${tag}: eliminato, nessuna proiezione per lui`);
      if (pages < 6) {
        const html = renderCampaignPage({ career: { playerId: campaign.playerCandidateId }, campaign }, parties, () => null);
        assert.ok(/data-metric="consenso-territoriale"/.test(html) && /data-metric="sondaggio"/.test(html), `${tag}: la pagina mostra consenso territoriale e sondaggio come misure distinte`);
        assert.ok(projection ? /data-metric="proiezione-ballottaggio"/.test(html) && /PROIEZIONE DEL BALLOTTAGGIO/.test(html) : true, `${tag}: la proiezione del ballottaggio ha il suo nome`);
        assert.ok(!/POSIZIONE NELLO SCENARIO/.test(html) && !/CONSENSO E SONDAGGIO DI CAMPAGNA/.test(html), `${tag}: nessuna etichetta che mescola misure diverse`);
        assert.ok(!/NaN|undefined/.test(html.replace(/data-[a-z-]+="[^"]*"/g, '')), `${tag}: nessun valore non valido`);
        pages++;
      }
    } else if (campaign.day === 7) {
      const html = renderCampaignPage({ career: { playerId: campaign.playerCandidateId }, campaign }, parties, () => null);
      assert.ok(/CONSENSO TERRITORIALE/.test(html) && /data-metric="sondaggio"/.test(html) && !/data-metric="proiezione-ballottaggio"/.test(html), `${tag}: nel primo turno non c'è proiezione del ballottaggio`);
    }
  }
  assert.equal(campaign.status, 'finished', `${tag}: la campagna finisce`);
  const end = engine.campaignMetrics(campaign);
  assert.ok(end.result && Number.isFinite(end.result.share) && end.result.share > 0, `${tag}: risultato della fase che ha deciso (${end.result?.stage})`);
  const first = campaign.firstRoundResult;
  if (first) {
    runoffs++;
    const inRunoff = first.runoffCandidateIds.includes(campaign.playerCandidateId);
    assert.equal(end.result.stage, inRunoff ? 'ballottaggio' : 'primo-turno', `${tag}: il risultato è della fase giusta`);
    if (!inRunoff) { eliminated++; near(end.result.share, first.playerShare, 0.01, `${tag}: chi esce al primo turno mostra la quota del primo turno`); }
    else {
      finalists++;
    }
  } else assert.equal(end.result.stage, 'primo-turno', `${tag}: senza ballottaggio il risultato è del primo turno`);
}
assert.ok(runoffs >= 6 && finalists >= 3 && eliminated >= 2, `Casi di ballottaggio sufficienti (${runoffs} ballottaggi, ${finalists} finalisti, ${eliminated} eliminati)`);
// no favouritism towards the player. With the choices of the two weeks put aside (no endorsement, no pact, no appeal, no strategy, every eliminated rival equally friendly to both finalists),
// the voters of the eliminated go to the two finalists in the same measure: the finalist who finished ahead is ahead in the projection, by the same gap, whoever he is, whatever the order of the
// candidates. Many campaigns, every one of them: a bias towards the player (or towards whoever comes first in the list) breaks this at once.
let neutralChecked = 0;
for (let seed = 1; seed <= 90; seed++) {
  let campaign = start(TYPES[0], 2000 + seed);
  for (let guard = 0; campaign.status === 'active' && campaign.stage !== 'ballottaggio' && guard < 260; guard++) {
    if (campaign.pendingEvents.length) { const e = campaign.pendingEvents[0]; campaign = engine.decideCampaignEvent(campaign, e.id, e.choices[(seed + guard) % e.choices.length].id); continue; }
    campaign = engine.advanceCampaign(campaign, 1);
  }
  if (campaign.stage !== 'ballottaggio' || campaign.status !== 'active') continue;
  const [a, b] = campaign.runoffCandidateIds;
  const neutralize = source => {
    const copy = JSON.parse(JSON.stringify(source));
    copy.runoff.stances = Object.fromEntries(Object.keys(copy.runoff.stances ?? {}).map(id => [id, { backs: null, kind: 'neutro' }]));
    copy.runoff.pacts = []; copy.runoff.appeal = 0; copy.runoff.transfers = null; copy.strategy = null;
    for (const candidate of copy.candidates) if (candidate.aiProfile) for (const id of Object.keys(candidate.aiProfile.relationships ?? {})) candidate.aiProfile.relationships[id] = 50;
    for (const candidate of copy.candidates) if (!candidate.isPlayer) candidate.relationship = .5;
    return copy;
  };
  const neutral = neutralize(campaign);
  const projection = engine.runoffProjection(neutral);
  const reversed = engine.runoffProjection({ ...neutral, candidates: [...neutral.candidates].reverse(), runoffCandidateIds: [b, a] });
  const raw = campaign.runoff.firstRoundRaw;
  const gap = raw[a] - raw[b];
  const projectionGap = projection[a] - projection[b];
  if (Math.abs(gap) > 0.3) { assert.equal(Math.sign(projectionGap), Math.sign(gap), `Seme ${seed}: il finalista avanti al primo turno (${raw[a]} contro ${raw[b]}) è avanti anche nella proiezione neutra (${projection[a]} contro ${projection[b]})`); neutralChecked++; }
  near(projection[a], reversed[a], 0.05, `Seme ${seed}: l'ordine dei candidati non cambia la proiezione`);
  // the player has no advantage as such: the same gap in either direction is worth the same on the projection
  const playerIsA = a === campaign.playerCandidateId;
  const gapForPlayer = playerIsA ? gap : -gap, projectionForPlayer = playerIsA ? projectionGap : -projectionGap;
  if (Math.abs(gapForPlayer) > 0.3) assert.ok(Math.sign(projectionForPlayer) === Math.sign(gapForPlayer), `Seme ${seed}: scarto di ${gapForPlayer.toFixed(1)} punti per il giocatore, ${projectionForPlayer.toFixed(1)} nella proiezione neutra`);
}
assert.ok(neutralChecked >= 30, `Abbastanza ballottaggi neutri verificati (${neutralChecked})`);
console.log(`Percentuali della campagna verificate: ${runoffs} ballottaggi su ${TYPES.reduce((n, t) => n + t.seeds, 0)} campagne di quattro tipi di elezione (${finalists} da finalista, ${eliminated} eliminati al primo turno); consenso territoriale, sondaggio, proiezione e risultato sono misure distinte e della fase giusta, il consenso territoriale si muove al massimo di ${maxJump.toFixed(1)} punti nel passaggio al ballottaggio, proiezione neutra coerente con il primo turno e indipendente dall'ordine dei candidati (${neutralChecked} ballottaggi verificati).`);
