// The political world over many years: realistic alliances (collocazione, majorities, interests, memory),
// simulated evolution of the parties (congresses, splits, mergers, new forces) kept apart from real data,
// difficulty that changes the game, varied news linked to the career, long political memory.
import assert from 'node:assert/strict';
import { advanceWorld, allianceOdds, axisOf, createWorld, proposeAlliance } from '../src/core/world-engine.js';
import { composeHeadline, weeklyNews, NEWS_TEMPLATES } from '../src/core/news-engine.js';
import { advanceWeek, createGameState, memoryAbout, memoryBalance, remember } from '../src/core/career-engine.js';
import { DIFFICULTIES } from '../src/data/simulation/difficulty-rules.js';
import { CAREER_EVENTS } from '../src/data/simulation/career-rules.js';
import { HARD_CATEGORIES } from '../src/data/simulation/difficulty-rules.js';

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
const addDays = (date, days) => { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10); };

// ---------- 1. starting point: real poll, collocazione, real majority ----------
let world = createWorld({ seedText: 'mondo-prova', date: '2026-09-24', place: { region: 'Lazio' }, playerParty: { id: 'io', label: 'Il mio partito', position: 'centro-sinistra', founder: true }, forces, realPoll });
assert.equal(world.polls[0].source, 'real');
assert.equal(world.polls[0].results.find(row => row.partyId === 'fdi').share, 26.6);
assert.equal(world.parties.find(item => item.id === 'fdi').strategy, 'governista');
assert.equal(world.parties.find(item => item.id === 'pd').strategy, 'opposizione');
const tie = (a, b) => world.ties[[a, b].sort().join('|')];
assert.ok(tie('fdi', 'lega') > tie('fdi', 'pd') + 30, 'Stessa area e stessa maggioranza: rapporti iniziali molto migliori.');
assert.ok(tie('pd', 'm5s') > tie('pd', 'fn'), 'Collocazioni vicine partono più vicine.');
assert.ok(world.parties.find(item => item.id === 'pd').playerRelation > world.parties.find(item => item.id === 'fdi').playerRelation, 'Il partito del giocatore parte più vicino a chi ha una collocazione simile.');

// ---------- 2. alliance odds with the player: why a force says yes or no ----------
const close = allianceOdds(world, 'pd', {});
const far = allianceOdds(world, 'fn', {});
assert.ok(close.chance > far.chance + 0.2, `Un’intesa con una forza vicina è molto più probabile (${close.chance} vs ${far.chance}).`);
assert.ok(close.reasons.some(item => /Collocazione/.test(item.label) && item.delta > 0));
assert.ok(far.reasons.some(item => /Collocazione/.test(item.label) && item.delta < 0));
assert.ok(far.reasons.some(item => /governo/.test(item.label)) || far.chance < 0.2, 'Chi sostiene il governo e chi è all’opposizione si allontanano.');
const scarred = allianceOdds(world, 'pd', { memory: { good: 0, bad: 2.5 } });
assert.ok(scarred.chance < close.chance - 0.15, 'Le rotture passate con quella forza pesano sulla trattativa.');
assert.ok(scarred.reasons.some(item => /Memoria/.test(item.label) && item.delta < 0));
const hard = allianceOdds(world, 'pd', { difficulty: DIFFICULTIES.difficile.allianceChance });
assert.ok(hard.chance < close.chance, 'In Difficile gli alleati sono più esigenti.');
// Across the whole spectrum only as a motivated exception.
const extreme = createWorld({ seedText: 'estremi', date: '2026-09-24', playerParty: { id: 'io', label: 'Il mio partito', position: 'estrema sinistra', founder: true }, forces: [...forces, { id: 'far', label: 'Estrema destra A', share: 1, position: 'estrema destra' }], realPoll });
assert.equal(allianceOdds(extreme, 'fdi', {}).chance, 0.03, 'Accordi incoerenti praticamente impossibili senza un motivo eccezionale.');
let attempt = proposeAlliance(world, 'pd', { date: '2026-09-24' });
assert.ok(Array.isArray(attempt.reasons) && attempt.world.events[0].body.length > 20, 'La risposta spiega il perché.');

// ---------- 3. ten years of simulated world ----------
let date = '2026-09-24';
const alliancesFormed = [];
const kinds = new Map();
const society = { mood: 50, moodDelta: 0, trust: 48, sentiment: 0 };
for (let week = 2; week <= 520; week++) {
  date = addDays(date, 7);
  const out = advanceWorld(world, { date, week, stats: { popularity: 45, reputation: 55, notoriety: 40 }, society });
  world = out.world;
  for (const event of world.events.filter(item => item.week === week)) kinds.set(event.kind, (kinds.get(event.kind) ?? 0) + 1);
}
for (const alliance of world.alliances.filter(item => !item.withPlayer)) {
  const [a, b] = alliance.partyIds.map(id => world.parties.find(item => item.id === id));
  const gap = Math.abs((a.axis ?? 0) - (b.axis ?? 0));
  alliancesFormed.push({ gap, motive: alliance.motive });
  assert.ok(gap <= 2 || /eccezione/.test(alliance.motive ?? ''), `Intesa incoerente senza motivo: ${alliance.label} (${alliance.motive})`);
  assert.ok(alliance.motive, 'Ogni intesa ha un motivo dichiarato.');
}
assert.ok(world.polls.every((poll, index) => index === 0 || poll.source !== 'real'), 'Dopo il primo, tutti i sondaggi sono simulati.');
assert.ok((kinds.get('congresso') ?? 0) >= 5, `Congressi dei partiti nel corso degli anni (${kinds.get('congresso') ?? 0}).`);
const evolved = world.parties.filter(item => item.origin === 'evoluzione');
for (const force of evolved) assert.ok(/simulat/.test(force.label) && force.refSource === 'simulation', `Le nuove forze sono dichiaratamente simulate: ${force.label}`);
for (const event of world.events.filter(item => ['congresso', 'scissione', 'fusione', 'nuova-forza', 'organizzazione'].includes(item.kind))) assert.ok(/simulat/.test(event.body), `Evento di partito senza etichetta di simulazione: ${event.title}`);
assert.ok(world.parties.filter(item => !item.isPlayer && item.origin !== 'evoluzione').every(item => forces.some(force => force.id === item.id)), 'I partiti reali restano quelli reali: nessun nome inventato al loro posto.');
assert.ok(world.parties.some(item => item.life?.congresses > 0 && ['nuova', 'confermata'].includes(item.life.leadership)));
console.log(`  dieci anni: ${alliancesFormed.length} intese (${alliancesFormed.filter(item => item.gap > 2).length} eccezioni motivate), congressi ${kinds.get('congresso') ?? 0}, scissioni ${kinds.get('scissione') ?? 0}, fusioni ${kinds.get('fusione') ?? 0}, nuove forze ${kinds.get('nuova-forza') ?? 0}, riorganizzazioni ${kinds.get('organizzazione') ?? 0}`);

// ---------- 4. difficulty changes the game, not just a number ----------
const start = difficulty => createGameState({ seedText: 'stessa-partita', currentDate: '2026-09-24', level: 'comunale', party: { id: 'p', label: 'Partito', founder: true }, place: { region: 'Puglia', municipality: 'Bari' }, stats: { influence: 30, popularity: 40, reputation: 50, notoriety: 30, experience: 20 }, difficulty });
const easy = start('facile'), normal = start('normale'), harsh = start('difficile');
assert.ok(easy.resources.funds > normal.resources.funds && normal.resources.funds > harsh.resources.funds, 'Fondi iniziali diversi.');
assert.ok(easy.resources.politicalCapital > harsh.resources.politicalCapital, 'Capitale politico diverso.');
assert.ok(easy.relations.find(item => item.id === 'media').value > harsh.relations.find(item => item.id === 'media').value, 'Rapporti iniziali diversi.');
const playYears = difficulty => {
  let game = start(difficulty);
  let stats = { influence: 30, popularity: 40, reputation: 50, notoriety: 45, experience: 20 };
  let day = '2026-09-24';
  let hardEvents = 0, allEvents = 0, capital = 0;
  for (let week = 0; week < 208; week++) {
    day = addDays(day, 7);
    const month = Number(day.slice(5, 7));
    const result = advanceWeek({ game, stats, parliament: null }, { currentDate: day, career: { currentLevel: 'comunale' }, offices: [], player: null, pollShare: 3, pollDelta: 0, signals: { crime: 55, spread: 180, summer: month >= 6 && month <= 8, autumn: month >= 9 && month <= 11, winter: month === 12 || month <= 2, regions: [] } }, parliament => parliament);
    game = result.ctx.game; stats = { ...result.ctx.stats, reputation: Math.max(result.ctx.stats.reputation, 30) };
    for (const item of game.inbox.filter(entry => entry.kind === 'evento' && entry.week === game.week.index)) { allEvents++; if (HARD_CATEGORIES.includes(CAREER_EVENTS.find(event => event.id === item.templateId)?.category)) hardEvents++; }
    capital += game.resources.politicalCapital;
  }
  return { hardShare: hardEvents / Math.max(1, allEvents), capital: capital / 208, status: game.status, week: game.week.index, days: game.week.maxAp };
};
const [e, n, h] = ['facile', 'normale', 'difficile'].map(playYears);
assert.ok(h.hardShare > e.hardShare, `Più crisi e scandali in Difficile (${h.hardShare.toFixed(2)} contro ${e.hardShare.toFixed(2)}).`);
assert.ok(e.capital > h.capital, 'Il capitale politico cresce più in fretta in Facile.');
assert.ok(e.days > h.days, 'Più giorni di lavoro a settimana in Facile.');
assert.ok([e, n, h].every(item => item.status === 'active' && item.week > 200), 'In ogni difficoltà la carriera continua.');
assert.ok(DIFFICULTIES.difficile.expulsionBelow > DIFFICULTIES.facile.expulsionBelow && DIFFICULTIES.difficile.candidacy < DIFFICULTIES.facile.candidacy && DIFFICULTIES.difficile.discipline < DIFFICULTIES.facile.discipline, 'Partito, candidature e Parlamento cambiano con la difficoltà.');

// ---------- 5. news: varied, linked, not repeated ----------
let recent = [];
const seen = [];
for (let week = 1; week <= 40; week++) { const out = composeHeadline(recent, 'pollUp', { week, party: 'Il mio partito', share: '5,4', delta: '+0,6', macro: 'Sud' }); recent = out.recent; seen.push(out.text); }
assert.ok(seen.every((text, index) => index === 0 || text !== seen[index - 1]), 'Mai lo stesso titolo due volte di seguito.');
assert.ok(new Set(seen).size >= NEWS_TEMPLATES.pollUp.length, 'Tutte le strutture di titolo vengono usate.');
assert.ok(seen.every(text => !/\{\w+\}/.test(text)), 'Nessun segnaposto nei titoli.');
const week = weeklyNews({ recent: [], week: 12, party: 'Il mio partito', pollRow: { share: 6.1, delta: -1.2 }, government: { status: 'active', stability: 28 }, finance: { spread: 260, deficit: 3.6, euStatus: 'procedura' }, region: 'Calabria', worstIndicator: 'Sanità', electionWeeks: 5, worldEvents: [{ kind: 'scissione', title: 'Scissione in Centro A' }] });
assert.ok(week.items.length >= 3 && new Set(week.items.map(item => item.kind)).size === week.items.length, 'Le notizie della settimana raccontano fatti diversi della partita.');
assert.ok(week.items.some(item => /Il mio partito/.test(item.headline)) && week.items.some(item => /spread|conti|Mercati|debito|Borsa|Bruxelles/i.test(item.headline)));

// ---------- 6. long political memory ----------
let game = start('normale');
remember(game, { kind: 'alleanza-rotta', text: 'Rotta l’intesa con Centro A', subject: 'az', weight: 3 });
game.week.index += 260;
for (let i = 0; i < 260; i++) remember(game, { kind: 'voto', text: `Voto ${i}`, weight: 0.1, tone: 'neutral' });
assert.ok(game.memory.some(item => item.subject === 'az'), 'Una scelta pesante resta in memoria per anni anche con centinaia di ricordi minori.');
assert.ok(memoryAbout(game, 'az', 'bad') > 0.2, 'Cinque anni dopo, quella rottura pesa ancora sui rapporti con quella forza.');
assert.ok(memoryBalance(game).highlights.some(item => item.yearsAgo >= 4), 'La memoria dice quanti anni sono passati.');
console.log('Mondo politico verificato: sondaggio reale all’avvio e poi simulato, rapporti iniziali da collocazione e maggioranza reale, probabilità di alleanza spiegate (collocazione, strategie, maggioranze, interessi, memoria, difficoltà), intese incoerenti solo come eccezioni motivate, dieci anni di congressi e cambi di leadership simulati, scissioni/fusioni/nuove forze dichiaratamente simulate, difficoltà con effetti su risorse, eventi, capitale e partito, notizie varie e collegate senza ripetizioni, memoria politica che pesa dopo anni.');
