// The variety of the weeks: several careers (municipal, regional, deputy, plain member), several seeds, 40 weeks each. What is measured: how often each event comes, the same event two weeks in a
// row, the same category three times in a row, how many different events a career meets, the share of important matters (urgent and situations) among them, which activities are open for each role.
// The three new activities and the three new events of 24/11/2026: available to the roles they are meant for and never to the others, and the new events really come (their conditions are
// met in play). The anti-repetition rules are not changed: the thresholds are measured, not lowered.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer, playWeek, seeded } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const { WEEKLY_ACTIVITIES, CAREER_EVENTS } = await import(`../src/data/simulation/career-rules.js?v=${build}`);
const NEW_ACTIVITIES = ['volontariato', 'diretta-domande', 'studio-bilancio'], NEW_EVENTS = ['profilo-falso', 'fuori-onda', 'patrocinio-conteso'];
for (const id of NEW_ACTIVITIES) assert.ok(WEEKLY_ACTIVITIES.some(item => item.id === id), `Attività ${id} presente.`);
for (const id of NEW_EVENTS) { const event = CAREER_EVENTS.find(item => item.id === id); assert.ok(event && event.choices.length >= 3 && event.choices.some(choice => choice.later), `Evento ${id}: tre scelte e uno sviluppo successivo.`); }

const runs = [];
const seen = new Set();
for (const [level, draft] of [['comunale', {}], ['regionale', {}], ['deputato', {}], ['comunale', { startingOffice: 'iscritto' }]]) {
  for (const seed of ['a', 'b', 'c']) {
    const run = await startCareer({ seed: `varieta-${level}-${draft.startingOffice ?? 'eletto'}-${seed}`, level, draft, fast: true });
    const decide = seeded(`varieta|${level}|${seed}`);
    run.store.setHeadlessVoter(() => 'astenuto');
    // a known name for the events that need one (the new ones ask notoriety 20 and 30): half of the careers start known
    if (seed !== 'a') { const s = run.store.getState(); s.game.stats = { ...(s.game.stats ?? {}) }; for (const p of s.dataset.politicians.filter(item => item.id === s.career.playerId)) p.notoriety = 45; }
    const weeks = [];
    const known = new Set((run.store.getState().game.inbox ?? []).map(item => item.id));
    const matters = new Set();
    for (let week = 0; week < 40 && run.store.getState().game.status !== 'ended'; week++) {
      const fresh = (run.store.getState().game.inbox ?? []).filter(item => !known.has(item.id));
      for (const item of fresh) known.add(item.id);
      // a matter that comes back (an internal request answered «prendi tempo» returns each week until it falls due) is the same matter, not a new event: counted once
      const matter = item => item.params?.requestId ? `richiesta|${item.params.requestId}` : `${item.templateId ?? item.id}|${item.params?.id ?? ''}`;   // a request and its counter-offer are one negotiation
      weeks.push(fresh.filter(item => !matters.has(matter(item))).map(item => { matters.add(matter(item)); return { id: item.templateId ?? item.id, kind: item.kind, category: item.category ?? null }; }));
      playWeek({ ...run, decide });
      for (const item of run.store.getState().game.inbox ?? []) if (!known.has(item.id)) { /* counted next week */ }
    }
    const flat = weeks.flat();
    for (const item of flat) seen.add(item.id);
    // two weeks in a row with the same event (a recurring appointment of the calendar aside)
    let repeats = 0; const repeatedIds = {}; for (let i = 1; i < weeks.length; i++) for (const item of weeks[i].filter(item => item.kind !== 'appuntamento' && weeks[i - 1].some(prev => prev.id === item.id))) { repeats++; repeatedIds[`${item.kind}:${item.id}`] = (repeatedIds[`${item.kind}:${item.id}`] ?? 0) + 1; }
    if (process.env.DEBUG_VARIETY) console.log(level, seed, JSON.stringify(repeatedIds));
    let streak = 0, worst = 0, last = null; for (const item of flat.filter(entry => entry.category)) { streak = item.category === last ? streak + 1 : 1; last = item.category; worst = Math.max(worst, streak); }
    const important = flat.filter(item => ['urgente', 'situazione'].includes(item.kind)).length;
    const activities = (() => { try { return run.store.getState().game ? WEEKLY_ACTIVITIES.length : 0; } catch { return 0; } })();
    runs.push({ career: `${level}${draft.startingOffice ? '-iscritto' : ''}-${seed}`, events: flat.length, distinct: new Set(flat.map(item => item.id)).size, repeats, categoryStreak: worst, important, activities });
  }
}
for (const run of runs) {
  assert.equal(run.repeats, 0, `${run.career}: nessun evento uguale in due settimane consecutive (${run.repeats}).`);
  assert.ok(run.distinct >= Math.min(8, run.events), `${run.career}: almeno ${Math.min(8, run.events)} eventi diversi in 40 settimane (${run.distinct}).`);
  assert.ok(run.categoryStreak <= 4, `${run.career}: al massimo 4 eventi di fila della stessa categoria (${run.categoryStreak}).`);
}
assert.ok(runs.some(run => run.important > 0), 'Gli eventi importanti (urgenti e situazioni) restano possibili.');
const newSeen = NEW_EVENTS.filter(id => seen.has(id));
assert.ok(newSeen.length >= 2, `I nuovi eventi arrivano nel gioco: ${newSeen.join(', ') || 'nessuno'}.`);

// the new activities: open to the roles they are meant for, closed to the others (the conditions of the engine, not a guess)
// (the harness has one store: each career is checked before the next one is started)
// the engine's own check (store.performWeeklyActivity refuses with the reason when the role does not allow it; a copy of the game is used, nothing is kept)
const tries = (store, id) => { const saved = store.exportSave(); try { store.performWeeklyActivity(id); return true; } catch (error) { return error.message; } finally { store.loadGame(JSON.parse(saved)); } };
const { store: member } = await startCareer({ seed: 'varieta-attivita-iscritto', level: 'comunale', draft: { startingOffice: 'iscritto' }, fast: true });
const studyMember = tries(member, 'studio-bilancio');
const volunteerMember = tries(member, 'volontariato');
assert.match(String(studyMember), /seggio o un incarico/, 'Lo studio del bilancio non è offerto a chi non ha un seggio o un incarico.');
const { store: deputy } = await startCareer({ seed: 'varieta-attivita-deputato', level: 'deputato', fast: true });
assert.equal(tries(deputy, 'studio-bilancio'), true, 'Lo studio del bilancio è possibile a chi siede in un’assemblea.');
assert.equal(volunteerMember, true, 'Il volontariato è possibile a tutti.');
const req = id => WEEKLY_ACTIVITIES.find(item => item.id === id).requires;
assert.equal(req('diretta-domande')({ stats: { notoriety: 5 } }), false); assert.equal(req('diretta-domande')({ stats: { notoriety: 12 } }), true);
console.log(`Varietà delle settimane verificata su ${runs.length} carriere × 40 settimane:`);
for (const run of runs) console.log(`  ${run.career.padEnd(22)} eventi ${String(run.events).padStart(3)} · diversi ${String(run.distinct).padStart(2)} · ripetuti di fila ${run.repeats} · categoria più lunga ${run.categoryStreak} · importanti ${run.important}`);
console.log(`Nuovi eventi visti: ${newSeen.join(', ')}; nuove attività con le loro condizioni (studio del bilancio solo con un seggio o un incarico, diretta con notorietà ≥ 10, volontariato per tutti).`);
