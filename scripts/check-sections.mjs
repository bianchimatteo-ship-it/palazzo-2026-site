// Carriera, Partito and Agenda as real sections: progression is never automatic (the same attempt ends in different
// ways, crossing a threshold never guarantees a promotion), every track shows its odds and blockers, the calendar
// collects every dated commitment of the career, and the three redesigned pages render every tab without invalid values.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = globalThis.localStorage;
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const read = async name => JSON.parse(await readFile(new URL(`../src/data/real/${name}.json`, import.meta.url), 'utf8'));
const groups = await read('parliamentary-groups');
const parties = await read('parties');
const realSnapshot = JSON.stringify(parties);
const { store } = await import(`../src/core/store.js${v}`);
const progression = await import(`../src/core/progression-engine.js${v}`);
const { careerOverview } = await import(`../src/core/career-overview.js${v}`);
const { agendaCalendar, agendaByMonth, weekDate } = await import(`../src/core/agenda-engine.js${v}`);
const { contestCommitteeRole, createParliamentState } = await import(`../src/core/parliament-engine.js${v}`);
const { CAREER_TABS, renderCareerPage } = await import(`../src/ui/career-page.js${v}`);
const { partyTabs, renderPartyPage } = await import(`../src/ui/party-page.js${v}`);
const { AGENDA_FILTERS, AGENDA_TABS, renderAgendaPage } = await import(`../src/ui/agenda-page.js${v}`);
const clean = html => !/undefined|NaN|\[object Object\]|Infinity/.test(html.replace(/data-[a-z-]+="[^"]*"/g, ''));

// ---------- 1. the progression model: odds, never certainty, many outcomes ----------
const factors = value => Object.fromEntries(['support', 'leadership', 'current', 'influence', 'reputation', 'experience', 'results', 'territory', 'party', 'group', 'seniority'].map(key => [key, value]));
let previous = 0;
for (const value of [20, 35, 50, 65, 80, 95]) {
  const odds = progression.advancementOdds('partito', { factors: factors(value), threshold: 56 });
  assert.ok(odds.chance >= .04 && odds.chance <= .86, `Probabilità sempre tra 4% e 86% (${odds.chance}).`);
  assert.ok(odds.chance >= previous, 'Più fattori favorevoli, più probabilità.');
  assert.ok(odds.factors.length === progression.PROGRESSION_WEIGHTS.partito.length && odds.factors.every(item => Number.isFinite(item.contribution)), 'Ogni fattore ha valore, peso e contributo.');
  previous = odds.chance;
}
const weightSum = kind => progression.PROGRESSION_WEIGHTS[kind].reduce((sum, [, , weight]) => sum + weight, 0);
assert.ok(Math.abs(weightSum('partito') - 1) < 1e-9 && Math.abs(weightSum('parlamento') - 1) < 1e-9, 'I pesi di ogni percorso sommano a 1.');
// Well above the threshold: a promotion is likely but not guaranteed.
const above = { promosso: 0, other: 0 };
for (let index = 0; index < 400; index++) {
  const result = progression.evaluateAdvancement('partito', { factors: factors(80), threshold: 56, rank: 1, hostile: true, roll: (index * 0.6180339887) % 1, roll2: (index * 0.4142135623) % 1 });
  above[result.outcome === 'promosso' ? 'promosso' : 'other']++;
}
assert.ok(above.promosso > 200 && above.other > 40, `Sopra soglia la promozione è probabile ma non certa (${JSON.stringify(above)}).`);
// Every outcome happens, depending on the situation.
const outcomes = new Set();
for (const [value, rank, hostile] of [[80, 1, false], [55, 2, true], [30, 3, true], [30, 2, false]]) {
  for (let index = 0; index < 300; index++) outcomes.add(progression.evaluateAdvancement('partito', { factors: factors(value), threshold: 56, rank, hostile, roll: (index * 0.7548776662) % 1, roll2: (index * 0.5698402909) % 1 }).outcome);
}
assert.deepEqual([...outcomes].sort(), Object.keys(progression.ADVANCEMENT_OUTCOMES).sort(), `Tutti gli esiti sono possibili: ${[...outcomes].join(', ')}.`);
// A demotion only when far below the bar, and only for who has something to lose.
for (let index = 0; index < 200; index++) assert.notEqual(progression.evaluateAdvancement('partito', { factors: factors(30), threshold: 56, rank: 0, hostile: true, roll: .99, roll2: index / 200 }).outcome, 'retrocessione', 'Un iscritto senza incarichi non può essere retrocesso.');

// ---------- 2. a career: tracks, odds and the record of every attempt ----------
const volt = parties.find(item => item.id === 'party-registro-p1-2024-71-ir');
store.createCareer({ firstName: 'Marta', lastName: 'Neri', birthDate: '1985-02-11', gender: 'donna', region: 'Toscana', municipality: 'Siena', previousProfession: 'Architetta', initialLevel: 'comunale', partyMode: 'existing', partyId: volt.id, parliamentStartMode: 'real-context', parliamentaryGroupId: '', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } }, [volt], groups);
let state = store.getState();
let overview = careerOverview(state);
assert.deepEqual(overview.tracks.map(track => track.id), ['istituzioni', 'partito', 'parlamento', 'governo'], 'Quattro percorsi: istituzioni, partito, Parlamento, governo.');
const partyTrack = overview.tracks.find(track => track.id === 'partito');
assert.ok(partyTrack.odds && partyTrack.odds.chance > 0 && partyTrack.odds.chance < 1 && partyTrack.next.title === 'Coordinatore locale', 'Il prossimo incarico nel partito mostra una probabilità, non una certezza.');
assert.ok(partyTrack.steps.some(step => step.current) && partyTrack.steps.filter(step => step.current).length === 1, 'Una sola tappa corrente.');
const parliamentTrack = overview.tracks.find(track => track.id === 'parlamento');
assert.ok(parliamentTrack.blocker && !parliamentTrack.odds, 'Senza seggio il percorso parlamentare è bloccato e lo dice.');
assert.ok(overview.tracks.find(track => track.id === 'governo').problems.length > 0, 'Il governo spiega cosa manca.');
// Attempts: capital and days allow a few; each ends with a recorded outcome and its odds.
const seen = new Set();
for (let attempt = 0; attempt < 8; attempt++) {
  const game = store.getState().game;
  game.week.ap = 6; game.resources.politicalCapital = 40; game.party.lastRankContestWeek = null;
  const before = game.party.contests?.length ?? 0;
  store.contestPartyRank();
  const after = store.getState().game.party;
  assert.equal(after.contests.length, Math.min(12, before + 1), 'Ogni tentativo resta nello storico.');
  const last = after.contests.at(-1);
  assert.ok(progression.ADVANCEMENT_OUTCOMES[last.outcome] && last.chance > 0 && last.chance < 1 && last.target, `Tentativo registrato con esito e probabilità (${last.outcome}).`);
  seen.add(last.outcome);
  if (after.rank >= 2) break;
}
assert.ok(seen.size >= 1, 'I tentativi producono esiti.');
state = store.getState();
overview = careerOverview(state);
assert.ok(overview.contests.length >= 1 && overview.contests.every(item => item.trackLabel && item.label), 'La Carriera elenca i tentativi recenti con percorso ed esito.');
// Parliament: the same model, with the history of contests in the group.
const parliament = createParliamentState({ career: { parliamentContext: { chamber: 'camera', groupId: 'cam-xix-04' } }, player: { id: 'giocatore-prova' }, groups, currentDate: '2026-09-25', politicalCapital: 30 });
assert.equal(parliament.player?.groupId, 'cam-xix-04', 'Scenario parlamentare di prova con un gruppo reale.');
{
  const first = contestCommitteeRole(parliament, '2026-09-25', { influence: 60, reputation: 60, experience: 55 }, { roll: .2, roll2: .5 });
  assert.ok(first.parliament.careerStanding.contests?.length === 1 && Number.isFinite(first.chance) && first.chance < 1, 'Anche in Parlamento ogni tentativo resta nello storico con la sua probabilità.');
  const second = contestCommitteeRole({ ...first.parliament, resources: { ...first.parliament.resources, politicalCapital: 30 } }, '2026-11-01', { influence: 60, reputation: 60, experience: 55 }, { roll: .99, roll2: .9 });
  assert.equal(second.parliament.careerStanding.contests.length, 2, 'Lo storico parlamentare si allunga a ogni tentativo.');
  assert.notEqual(second.outcome, 'promosso', 'Con un’estrazione sfavorevole la promozione non arriva, anche con buoni numeri.');
}

// ---------- 3. the agenda: every dated commitment, in order ----------
const game = state.game;
game.promises = [...(game.promises ?? []), { id: 'promessa-test', region: 'Toscana', indicator: 'servizi', topic: 'Sanità', madeWeek: game.week.index, dueWeek: game.week.index + 3, baseline: 50, status: 'open', source: 'simulation' }];
game.pending = [...(game.pending ?? []), { id: 'seguito-test', dueWeek: game.week.index + 2, madeWeek: game.week.index, hint: 'La stampa tornerà sulla vicenda', label: 'Esito', chance: .5, origin: 'Scelta di prova', source: 'simulation' }];
const calendar = agendaCalendar(state);
assert.ok(calendar.length >= 4, 'Il calendario raccoglie più tipi di impegni.');
for (const kind of ['candidature', 'elezione', 'promessa', 'conseguenza']) assert.ok(calendar.some(item => item.kind === kind), `Calendario: manca ${kind}.`);
if (game.party?.org && !game.party.org.founder) assert.ok(calendar.some(item => item.kind === 'congresso'), 'Il congresso del partito è in calendario.');
assert.ok(calendar.every((item, index) => index === 0 || calendar[index - 1].date <= item.date), 'Impegni in ordine di data.');
assert.ok(calendar.every(item => item.days >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && item.title && !/undefined|NaN/.test(`${item.title} ${item.detail ?? ''}`)), 'Solo impegni futuri, con data e testo validi.');
assert.equal(calendar.find(item => item.id === 'promessa-test').date, weekDate(game, game.week.index + 3), 'La scadenza di una promessa cade nella sua settimana.');
assert.ok(calendar.find(item => item.id === 'promessa-test').urgent, 'Una promessa vicina è urgente.');
assert.equal(agendaByMonth(calendar).reduce((sum, month) => sum + month.entries.length, 0), calendar.length, 'Il raggruppamento per mese non perde impegni.');

// ---------- 4. the three sections render every tab ----------
const record = [volt].find(item => item.id === state.career.partyId) ?? null;
for (const [tab] of CAREER_TABS) {
  const html = renderCareerPage(state, { tab });
  assert.ok(html.includes('career-page') && html.includes(`data-section-tab-value="${tab}" aria-selected="true"`), `Carriera: la scheda ${tab} si apre.`);
  assert.ok(clean(html), `Carriera/${tab}: valori non validi.`);
}
assert.ok(renderCareerPage(state, { tab: 'inesistente' }).includes('data-section-tab-value="percorso" aria-selected="true"'), 'Una scheda sconosciuta torna al Percorso.');
for (const [tab] of partyTabs(state)) {
  const html = renderPartyPage(state, { tab, record, logoFor: () => null });
  assert.ok(html.includes('party-page') && clean(html), `Partito/${tab}: pagina valida.`);
}
assert.ok(!partyTabs(state).some(([id]) => id === 'segreteria'), 'Un iscritto non ha la scheda Segreteria.');
for (const [tab] of AGENDA_TABS) {
  const html = renderAgendaPage(state, { tab, events: state.dataset.events ?? [] });
  assert.ok(html.includes('agenda-page') && clean(html), `Agenda/${tab}: pagina valida.`);
}
for (const [filter, , kinds] of AGENDA_FILTERS) {
  const html = renderAgendaPage(state, { tab: 'calendario', filter });
  assert.ok(html.includes(`data-view-filter-value="${filter}" class="active"`) && clean(html), `Agenda: il filtro ${filter} resta selezionato.`);
  if (kinds) assert.equal((html.match(/class="ag-item /g) ?? []).length, calendar.filter(item => kinds.includes(item.kind)).length, `Agenda: il filtro ${filter} mostra solo i suoi impegni.`);
}
const calendarHtml = renderAgendaPage(state, { tab: 'calendario' });
assert.ok(calendarHtml.includes('ag-grid') && calendarHtml.includes('is-today') && calendarHtml.includes('has-items'), 'Il calendario mostra la griglia del mese con oggi e i giorni impegnati.');
assert.equal(JSON.stringify(parties), realSnapshot, 'I dati reali dei partiti non cambiano.');

console.log(`Sezioni verificate: progressione non automatica (probabilità 4–86%, esiti ${[...outcomes].join(', ')}), ${overview.tracks.length} percorsi di carriera con probabilità e blocchi, ${overview.contests.length} tentativi registrati, agenda con ${calendar.length} impegni in ordine (elezioni, candidature, congresso, promesse, conseguenze), Carriera ${CAREER_TABS.length} schede, Partito ${partyTabs(state).length} schede, Agenda ${AGENDA_TABS.length} schede e ${AGENDA_FILTERS.length} filtri senza valori non validi.`);
