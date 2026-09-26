// Parties and alliances that live on their own: coalitions of several forces negotiated with requests, vetoes and
// concessions (and ruptures), goals and agendas of the parties that change over time and reach their groups in the
// Chambers, new forces without a fixed ceiling, electoral coalitions that follow the negotiated ones, campaigns with
// more rivals who clash, gain, lose and withdraw.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const W = await import(`../src/core/world-engine.js${v}`);
const L = await import(`../src/core/legislature-engine.js${v}`);
const P = await import(`../src/core/parliament-engine.js${v}`);
const C = await import(`../src/core/campaign-engine.js${v}`);
const { AREA_BY_ID } = await import(`../src/data/simulation/policy-rules.js${v}`);

const forces = [
  { id: 'fdi', label: 'Destra A', share: 26.6, position: 'destra', governing: true },
  { id: 'pd', label: 'Centrosinistra A', share: 21.1, position: 'centro-sinistra' },
  { id: 'm5s', label: 'Centrosinistra B', share: 12.5, position: 'centro-sinistra' },
  { id: 'fn', label: 'Destra B', share: 7.7, position: 'destra' },
  { id: 'fi', label: 'Centrodestra A', share: 7.4, position: 'centro-destra', governing: true },
  { id: 'avs', label: 'Sinistra A', share: 6.4, position: 'sinistra' },
  { id: 'lega', label: 'Destra C', share: 5.6, position: 'destra', governing: true },
  { id: 'az', label: 'Centro A', share: 3.3, position: 'centro' },
  { id: 'iv', label: 'Centro B', share: 2.3, position: 'centro' },
  { id: 'pe', label: 'Centro C', share: 1.5, position: 'centro' }
];
const realPoll = { id: 'test', label: 'Media reale di prova', publishedAt: '2026-09-17', sourceUrl: 'https://example.org/sondaggio', sourceName: 'Fonte di prova', results: forces.map(item => ({ partyId: item.id, share: item.share })) };
const addDays = (date, days) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };
const society = trust => ({ mood: 50, moodDelta: 0, trust, sentiment: 0 });

// ---------- 1. a year and a half towards a general election, several seeds ----------
const terms = new Map();
let biggest = 0, offers = 0, broken = 0, goalsSeen = new Set(), agendaChanges = 0;
for (const seed of ['coalizioni-1', 'coalizioni-2', 'coalizioni-3', 'coalizioni-4']) {
  let world = W.createWorld({ seedText: seed, date: '2026-09-24', place: { region: 'Lazio' }, playerParty: { id: 'io', label: 'Il mio partito', position: 'centro-sinistra', founder: true }, forces, realPoll });
  let date = '2026-09-24';
  for (let week = 2; week <= 80; week++) {
    date = addDays(date, 7);
    const out = W.advanceWorld(world, { date, week, stats: { popularity: 45, reputation: 55, notoriety: 40 }, society: society(48), playerIsLeader: true, nationalVoteIn: 80 - week });
    world = out.world;
    offers += out.offers.filter(item => item.templateId === 'proposta-coalizione').length;
  }
  for (const alliance of world.alliances.filter(item => item.status === 'active' && item.partyIds.length >= 2)) {
    const members = alliance.partyIds.map(id => world.parties.find(item => item.id === id));
    const leader = [...members].sort((a, b) => b.baseline - a.baseline)[0];
    biggest = Math.max(biggest, members.length);
    for (const member of members) assert.ok(Math.abs((member.axis ?? 0) - (leader.axis ?? 0)) <= 2 || /eccezione/.test(alliance.motive ?? ''), `${alliance.label}: ${member.label} troppo lontano da ${leader.label} senza un motivo.`);
    for (const term of alliance.terms ?? []) { terms.set(term.kind, (terms.get(term.kind) ?? 0) + 1); assert.ok(term.text && term.partyId && term.date); }
  }
  broken += world.events.filter(item => item.kind === 'rottura').length;
  for (const party of world.parties.filter(item => item.active)) {
    if (!party.isPlayer) { assert.ok(party.goal && party.agenda?.length === 3 && party.agenda.every(id => AREA_BY_ID[id]), `${party.label}: ha obiettivo e agenda.`); goalsSeen.add(party.goal); }
  }
  agendaChanges += world.events.filter(item => /cambia priorità/.test(item.title)).length;
  // The electoral coalitions follow the negotiated ones.
  const coalitions = L.buildCoalitions(world);
  for (const alliance of world.alliances.filter(item => item.status === 'active' && item.partyIds.length >= 2 && !item.partyIds.includes('io'))) {
    const homes = new Set(alliance.partyIds.map(id => L.coalitionOf(coalitions, id)?.id ?? `solo-${id}`));
    assert.equal(homes.size, 1, `${alliance.label}: gli alleati corrono insieme alle politiche.`);
  }
}
assert.ok(biggest >= 3, `Coalizioni di più forze (fino a ${biggest}).`);
assert.ok(terms.size >= 1, `Le adesioni si trattano: ${[...terms.entries()].map(([kind, count]) => `${kind} ${count}`).join(', ')}.`);
assert.ok(goalsSeen.size >= 3, `Obiettivi diversi tra i partiti (${[...goalsSeen].join(', ')}).`);
assert.ok(offers >= 1, 'Il partito del giocatore riceve inviti nelle coalizioni.');
console.log(`  Coalizioni: fino a ${biggest} forze, condizioni ${[...terms.entries()].map(([kind, count]) => `${kind} ${count}`).join(', ')}, ${broken} rotture/uscite, ${offers} inviti al giocatore, obiettivi ${[...goalsSeen].join('/')}, ${agendaChanges} cambi di priorità.`);

// ---------- 2. the player's party negotiates its entry ----------
{
  let world = W.createWorld({ seedText: 'invito', date: '2026-09-24', place: { region: 'Lazio' }, playerParty: { id: 'io', label: 'Il mio partito', position: 'centro-sinistra', founder: true }, forces, realPoll });
  world.alliances.push({ id: 'coal-prova', label: 'Coalizione guidata da Centrosinistra A', partyIds: ['pd', 'avs'], cohesion: 70, since: '2026-09-24', status: 'active', motive: 'prova', source: 'simulation' });
  const plain = W.joinCoalition(world, 'coal-prova', '2026-10-01');
  assert.ok(plain.joined && plain.world.alliances.find(item => item.id === 'coal-prova').partyIds.includes('io'), 'Il partito del giocatore entra nella coalizione.');
  assert.ok(W.allianceOf(plain.world, 'io')?.id === 'coal-prova');
  let joined = 0, refused = 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    const trial = structuredClone(world);
    trial.rngState = 1000 + attempt * 7919;
    const out = W.joinCoalition(trial, 'coal-prova', '2026-10-01', { terms: true });
    if (out.joined) { joined++; assert.ok(out.world.alliances.find(item => item.id === 'coal-prova').terms?.some(item => item.partyId === 'io'), 'Le condizioni ottenute restano nell’accordo.'); }
    else { refused++; assert.ok(out.world.events[0].title.startsWith('Nessun accordo'), 'Un rifiuto è raccontato.'); }
  }
  assert.ok(joined + refused === 12, 'Trattare le condizioni può riuscire o fallire.');
  // Leaving a coalition of three: the others stay together.
  const three = structuredClone(plain.world);
  const left = W.breakAlliance(three, 'coal-prova', '2026-11-01');
  const coalition = left.alliances.find(item => item.id === 'coal-prova');
  assert.ok(coalition.status === 'active' && !coalition.partyIds.includes('io') && coalition.partyIds.length === 2, 'Uscendo da una coalizione di tre, gli altri restano insieme.');
  console.log(`  Condizioni del giocatore: ${joined} accordi, ${refused} rifiuti su 12 prove.`);
}

// ---------- 3. new forces without a fixed ceiling ----------
{
  let world = W.createWorld({ seedText: 'sfiducia', date: '2026-09-24', place: { region: 'Lazio' }, playerParty: null, forces, realPoll });
  let date = '2026-09-24';
  for (let week = 2; week <= 520; week++) { date = addDays(date, 7); world = W.advanceWorld(world, { date, week, stats: {}, society: society(25) }).world; }
  const evolved = world.parties.filter(item => item.origin === 'evoluzione');
  assert.ok(evolved.length >= 1, 'Con una fiducia molto bassa nascono nuove forze (movimenti di protesta, liste civiche).');
  assert.ok(evolved.every(item => /simulat/.test(item.label) && item.refSource === 'simulation'), 'Le nuove forze sono dichiaratamente simulate.');
  console.log(`  Dieci anni di sfiducia: ${evolved.length} nuove forze (${evolved.map(item => item.label).join(', ')}).`);
}

// ---------- 4. the agenda of a force reaches its groups in the Chambers ----------
{
  const group = { groupId: 'g1', partyId: 'fdi', axis: 2, agenda: ['casa', 'sport', 'pa'] };
  assert.deepEqual(P.groupProfile(group).likes, ['casa', 'sport', 'pa'], 'Le priorità del gruppo seguono l’agenda attuale del suo partito.');
  assert.notDeepEqual(P.groupProfile({ ...group, agenda: ['sanita', 'scuola', 'lavoro'] }).likes, P.groupProfile(group).likes, 'Quando l’agenda cambia, cambiano anche le priorità in Aula.');
}

// ---------- 5. campaigns with more rivals, who act among themselves ----------
{
  const player = { id: 'p1', displayName: 'Candidata di prova', region: 'Toscana', municipality: 'Firenze', territoryId: null, partyId: null };
  const catalog = forces.map(item => ({ id: item.id, name: item.label, officialName: item.label, source: 'real', status: 'active' }));
  const counts = {};
  let clashes = 0, withdrawn = 0;
  for (const [type, role, band] of [['comunale', 'sindaco', 'fino-15000'], ['comunale', 'sindaco', 'oltre-15000'], ['regionale', 'presidente', null], ['politiche', 'deputato', null], ['europee', 'eurodeputato', null]]) {
    for (let run = 0; run < 3; run++) {
      let campaign = C.createCampaign({ career: { id: `campagna-${type}-${run}`, partyId: null }, player, statistics: [], partyCatalog: catalog, currentDate: '2026-10-01', config: { electionType: type, role, municipalityBand: band ?? undefined, partyWeights: Object.fromEntries(forces.map(item => [item.id, item.share])) } });
      counts[`${type}${band ? `-${band}` : ''}`] = campaign.candidates.length - 1;
      campaign = C.advanceCampaign(campaign, campaign.totalDays + 20);
      clashes += campaign.history.filter(item => item.type === 'scontro').length;
      withdrawn += campaign.candidates.filter(item => item.status === 'withdrawn').length;
      assert.ok(campaign.status === 'finished' && campaign.result, `${type}: la campagna arriva al voto.`);
    }
  }
  assert.deepEqual(counts, { 'comunale-fino-15000': 3, 'comunale-oltre-15000': 4, regionale: 4, politiche: 5, europee: 6 }, 'Più candidature dove corrono davvero più forze.');
  assert.ok(clashes >= 3, `Le candidature rivali si scontrano tra loro (${clashes} scontri).`);
  console.log(`  Campagne: rivali ${Object.entries(counts).map(([type, count]) => `${type} ${count}`).join(', ')}; ${clashes} scontri tra rivali, ${withdrawn} ritiri con indicazione di voto.`);
}

console.log('Partiti e alleanze verificati: coalizioni di più forze trattate con richieste, veti e concessioni, rotture e uscite, obiettivi e agende che cambiano e arrivano in Aula, nuove forze senza tetto fisso, coalizioni elettorali coerenti con quelle trattate, campagne con più avversari che si muovono da soli.');
