// What the observatory adds to the voting intentions: the approval of the Government and of the leader over time, the regional trend of each force, the approval of single laws
// (a different reading from the vote, declared with its uncertainty, measuring the simulation and moving nothing by itself) and a coalition against running alone. The institutes A–D
// keep their methods; a law's clear reading has consequences once, limited and fading; nothing of it changes the game when it is only looked at.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const obsEngine = await import(`../src/core/poll-observatory.js${v}`);
const rules = await import(`../src/data/simulation/polling-rules.js${v}`);
const worldEngine = await import(`../src/core/world-engine.js${v}`);
const society = await import(`../src/core/society-engine.js${v}`);
const { checkInvariants } = await import(`../src/core/invariants.js${v}`);
const ui = await import(`../src/ui/observatory-view.js${v}`);
const copy = value => JSON.parse(JSON.stringify(value));
const bad = text => /undefined|NaN|\[object|Infinity/.test(text.replace(/data-[a-z-]+="[^"]*"/g, ''));
const EXT = rules.POLL_EXTENSIONS;

// ---------- 1. the four institutes stay what they were ----------
assert.deepEqual(rules.POLL_INSTITUTES.map(item => item.id), ['a', 'b', 'c', 'd'], 'Quattro istituti, A–D.');
assert.ok(rules.POLL_INSTITUTES.every(item => item.mode && item.weighting && item.sample.length === 2), 'Ognuno con la sua metodologia e il suo campione.');
const fresh = obsEngine.freshObservatory();
assert.deepEqual([fresh.approval, fresh.regional, fresh.laws], [[], [], []], 'L’osservatorio nuovo ha i contenitori del gradimento, delle regioni e delle leggi.');
const legacy = obsEngine.normalizeObservatory({ version: 1, source: 'simulation', institutes: { a: { errors: { x: 0.1 }, history: [{ week: 1 }] } }, average: [{ week: 1 }], segments: [] });
assert.ok(Array.isArray(legacy.approval) && Array.isArray(legacy.laws) && legacy.institutes.a.errors.x === 0.1 && legacy.institutes.d.history.length === 0, 'Un osservatorio salvato prima li riceve senza perdere gli storici degli istituti.');

// ---------- 2. approval over time ----------
let obs = obsEngine.freshObservatory();
for (let week = 1; week <= EXT.approvalKept + 5; week++) obs = obsEngine.recordApproval(obs, { week, date: '2027-01-01', government: 40 + (week % 7), executive: null, leader: 45, margin: 3 });
assert.equal(obs.approval.length, EXT.approvalKept, 'Il gradimento ha un tetto di settimane.');
assert.ok(obs.approval.at(-1).government === 40 + ((EXT.approvalKept + 5) % 7) && obs.approval.at(-1).leader === 45 && obs.approval.every(item => item.executive === null), 'Governo, leader ed esecutivo restano distinti.');
assert.equal(obsEngine.recordApproval(obs, { week: 999, date: '2027-01-01' }).approval.length, EXT.approvalKept, 'Senza letture non si aggiunge nulla.');
const sameWeek = obsEngine.recordApproval(obs, { week: obs.approval.at(-1).week, date: '2027-01-01', government: 99, leader: 1, margin: 1 });
assert.equal(sameWeek.approval.length, EXT.approvalKept, 'Una settimana vale una lettura.');

// ---------- 3. the regional trend ----------
let regional = obsEngine.freshObservatory();
const rows = { Lazio: [{ partyId: 'a', share: 20.04 }, { partyId: 'b', share: 15 }, { partyId: 'z', share: 3 }], Toscana: [{ partyId: 'a', share: 22 }, { partyId: 'b', share: 12 }] };
for (let week = 1; week <= EXT.regional.every * (EXT.regional.kept + 3); week++) regional = obsEngine.recordRegional(regional, { week, date: '2027-01-01', regional: rows, partyIds: ['a', 'b'] });
assert.equal(regional.regional.length, EXT.regional.kept, 'Un quadro ogni quattro settimane, con un tetto.');
assert.ok(regional.regional.every(item => item.week % EXT.regional.every === 0 && item.rows.Lazio.length === 2), 'Solo le forze scelte, ogni quattro settimane.');
assert.deepEqual(obsEngine.regionalSeries(regional, 'a', 'Lazio').slice(0, 2).map(item => item.share), [20, 20], 'La serie regionale di una forza.');
assert.equal(obsEngine.regionalSeries(regional, 'zz', 'Lazio').length, 0, 'Una forza non registrata non ha serie.');

// ---------- 4. the approval of a law: from what it does, with its uncertainty, in two moments ----------
const segments = [{ id: 'giovani', label: 'Giovani', share: 22 }, { id: 'famiglie', label: 'Famiglie', share: 30 }, { id: 'anziani', label: 'Pensionati', share: 24 }, { id: 'imprese', label: 'Imprese', share: 12 }, { id: 'fragili', label: 'Redditi bassi', share: 12 }].map(item => ({ ...item, satisfaction: 50, participation: 60, trust: 50, economic: 50 }));
const soc = { segments, areas: { lavoro: 50 } };
const entries = [{ id: 'g1', share: 28, agenda: ['lavoro'], stance: 1 }, { id: 'o1', share: 24, agenda: ['sanita'], stance: -1 }, { id: 'o2', share: 15, agenda: ['ambiente'], stance: -1 }, { id: 'c1', share: 10, agenda: ['fisco'], stance: 0 }];
const law = { lawId: 'legge-s1', title: 'Riforma del lavoro', category: 'Lavoro', area: 'lavoro', week: 5, date: '2027-02-01', origin: 'governo', covered: true, deficit: 0.05, controversy: 0.6, winners: [{ id: 'giovani', delta: 2 }, { id: 'fragili', delta: 1.2 }], losers: [{ id: 'imprese', delta: -1.8 }] };
const survey = (overrides = {}, week = 6) => obsEngine.lawSurveys(obsEngine.freshObservatory(), { week, date: '2027-02-08', seed: 'seme-s', lawsApplied: [{ ...law, ...overrides }], society: soc, entries, undecided: 27 });
const early = survey({}, 5);
assert.equal(early.laws.length, 0, 'Prima di una settimana dall’entrata in vigore non c’è nulla da misurare.');
const first = survey().laws[0];
assert.ok(first.surveys.length === 1 && first.surveys[0].stage === 'primo' && first.title === law.title, 'Una settimana dopo, la prima rilevazione.');
const reading = first.surveys[0];
assert.ok(reading.approval > 0 && reading.against > 0 && Math.abs(reading.approval + reading.against + reading.undecided - 100) < 0.5, 'Favorevoli, contrari e indecisi fanno cento.');
assert.ok(reading.margin >= EXT.laws.model && reading.institutes.length === 4 && reading.institutes.every(item => item.sample > 0 && item.approval >= 1 && item.approval <= 99), 'Quattro istituti, ognuno con il suo campione, e un margine che include il modello.');
assert.ok(new Set(reading.institutes.map(item => item.approval)).size >= 2, 'Gli istituti non leggono lo stesso numero.');
const bySeg = Object.fromEntries(reading.bySegment.map(item => [item.id, item.approval]));
assert.ok(bySeg.giovani > bySeg.imprese && bySeg.fragili > bySeg.imprese, 'Chi ci guadagna approva più di chi ci perde.');
assert.ok(survey({ covered: false, deficit: 0.3 }).laws[0].surveys[0].decided < reading.decided, 'Una legge non coperta, che aggrava il deficit, piace meno.');
assert.ok(survey({ origin: 'opposizione' }).laws[0].surveys[0].decided !== reading.decided, 'Chi è d’accordo con il Governo giudica diversamente una legge del Governo e una dell’opposizione.');
assert.deepEqual(survey().laws, survey().laws, 'Stessi fatti, stessa rilevazione (nessun numero casuale).');
assert.notDeepEqual(obsEngine.lawSurveys(obsEngine.freshObservatory(), { week: 6, date: '2027-02-08', seed: 'altro-seme', lawsApplied: [law], society: soc, entries, undecided: 27 }).laws[0].surveys[0].institutes, reading.institutes, 'Un’altra partita, altri errori di campione.');
const approvedLoss = survey({ winners: [], losers: [{ id: 'giovani', delta: -2 }, { id: 'famiglie', delta: -2 }, { id: 'anziani', delta: -2 }, { id: 'imprese', delta: -2 }, { id: 'fragili', delta: -2 }] }).laws[0].surveys[0];
assert.equal(approvedLoss.verdict, 'contrari', 'Se tutti ci perdono la legge è bocciata.');
const approvedWin = survey({ winners: segments.map(item => ({ id: item.id, delta: 2.5 })), losers: [], controversy: 0.1, deficit: 0 }).laws[0].surveys[0];
assert.equal(approvedWin.verdict, 'favorevoli', 'Se tutti ci guadagnano è promossa.');
// Two moments, once each; a controversial law loses ground with time.
let both = survey({}, 6);
both = obsEngine.lawSurveys(both, { week: 7, date: '2027-02-15', seed: 'seme-s', lawsApplied: [law], society: soc, entries });
assert.equal(both.laws[0].surveys.length, 1, 'La seconda rilevazione non arriva subito.');
both = obsEngine.lawSurveys(both, { week: 14, date: '2027-04-05', seed: 'seme-s', lawsApplied: [law], society: soc, entries });
both = obsEngine.lawSurveys(both, { week: 15, date: '2027-04-12', seed: 'seme-s', lawsApplied: [law], society: soc, entries });
assert.deepEqual(both.laws[0].surveys.map(item => item.stage), ['primo', 'bilancio'], 'Una rilevazione per fase, dopo due mesi la seconda, una volta sola.');
assert.ok(both.laws[0].surveys[1].decided < both.laws[0].surveys[0].decided + 1.5, 'Dopo due mesi una legge controversa non guadagna.');
// A cap.
let many = obsEngine.freshObservatory();
for (let index = 0; index < 20; index++) many = obsEngine.lawSurveys(many, { week: 6 + index, date: '2027-02-08', seed: 'seme-s', lawsApplied: [{ ...law, lawId: `legge-${index}`, title: `Legge ${index}`, week: 5 + index }], society: soc, entries });
assert.ok(many.laws.length <= EXT.laws.kept, 'Le leggi misurate hanno un tetto.');
assert.deepEqual(obsEngine.lawSurveys(obsEngine.freshObservatory(), { week: 6, date: '2027-02-08', seed: 's', lawsApplied: [law], society: null, entries }).laws, [], 'Senza segmenti della società non si inventa nulla.');

// ---------- 5. a coalition against running alone: leak, uncertainty, nothing invented ----------
const forces = [{ id: 'p', label: 'Partito P', share: 20, axis: -1, spread: 0.4, isPlayer: true }, { id: 'q', label: 'Partito Q', share: 12, axis: -1.5, spread: 0.3 }, { id: 'r', label: 'Partito R', share: 8, axis: 1.5, spread: 0.3 }, { id: 's', label: 'Partito S', share: 5, axis: -0.5, spread: 0.3 }];
const solo = obsEngine.coalitionScenario({ memberIds: ['p'], leaderId: 'p', forces });
assert.ok(solo.total === 20 && solo.gain === 0 && solo.lost === 0 && solo.rows.length === 1 && solo.low <= 20 && solo.high >= 20, 'Da sola vale quanto vale, con la sua incertezza.');
const near = obsEngine.coalitionScenario({ memberIds: ['p', 'q'], leaderId: 'p', forces }), far = obsEngine.coalitionScenario({ memberIds: ['p', 'r'], leaderId: 'p', forces });
assert.ok(near.total > 20 && near.total < 32 && near.lost > 0, 'Una coalizione vale meno della somma: una parte si perde per strada.');
assert.ok(near.rows[1].leak < far.rows[1].leak, 'Si perde di più con una forza lontana sull’asse.');
assert.ok(near.gain / 12 > far.gain / 8, 'Alleati vicini rendono di più di alleati lontani, in proporzione.');
assert.ok(near.low < near.total && near.total < near.high && near.uncertainty > 0, 'Ogni proiezione dichiara il suo intervallo.');
const goodTies = obsEngine.coalitionScenario({ memberIds: ['p', 'q'], leaderId: 'p', forces, ties: { 'p|q': 60 } }), badTies = obsEngine.coalitionScenario({ memberIds: ['p', 'q'], leaderId: 'p', forces, ties: { 'p|q': -40 } });
assert.ok(goodTies.total > badTies.total, 'Buoni rapporti fra i partiti perdono meno elettori.');
const before = JSON.stringify(forces);
obsEngine.defaultScenarios({ alliances: [{ id: 'al', status: 'active', label: 'Intesa P-S', partyIds: ['p', 's'] }], ties: {} }, forces);
assert.equal(JSON.stringify(forces), before, 'Calcolare uno scenario non modifica nulla.');
const defaults = obsEngine.defaultScenarios({ alliances: [{ id: 'al', status: 'active', label: 'Intesa P-S', partyIds: ['p', 's'] }], ties: {} }, forces);
assert.deepEqual(defaults.map(item => item.id), ['solo', 'alleanza:al', 'campo-largo'], 'Gli scenari offerti: da soli, le alleanze vere, un campo largo.');
assert.ok(defaults.find(item => item.id === 'campo-largo').rows.every(row => row.id === 'p' || Math.abs(forces.find(item => item.id === row.id).axis - -1) <= 1.5), 'Il campo largo non include forze troppo lontane.');

// ---------- 6. in the game ----------
const run = await startCareer({ seed: 'osservatorio-ext', level: 'deputato' });
const { store } = run;
const st = () => store.getState();
const edit = change => { const save = JSON.parse(store.exportSave()); change(save); store.loadGame(save); };
for (let i = 0; i < 9; i++) store.advance(7);
const obsState = () => st().world.observatory;
assert.ok(obsState().approval.length >= 8 && obsState().approval.at(-1).leader !== undefined && obsState().approval.some(item => item.government !== null), 'Con il gradimento del Governo e del leader.');
assert.ok(obsState().regional.length >= 2 && obsState().regional.every(item => Object.keys(item.rows).length === 20), 'Il quadro regionale è registrato per tutte e venti le regioni.');
// A law in force: the surveys come by themselves, once each.
const week = st().game.week.index;
edit(save => { save.society.lawsApplied.unshift({ ...copy(law), lawId: 'legge-sondaggio', title: 'Legge di prova sui sondaggi', week: save.game.week.index, date: save.clock.currentDate, covered: false, deficit: 0.4, controversy: 1.2, winners: [], losers: segments.map(item => ({ id: item.id, label: item.label, delta: -2.2, reason: 'paga o perde con deficit' })), origin: 'governo' }); });
const stabilityBefore = st().parliament.government.stability;
store.advance(7); store.advance(7);
const record = obsState().laws.find(item => item.lawId === 'legge-sondaggio');
assert.ok(record && record.surveys.length === 1 && record.surveys[0].applied === true, 'La legge è stata misurata e la lettura è stata consumata.');
assert.equal(record.surveys[0].verdict, 'contrari', 'Una legge che penalizza tutti e non è coperta è bocciata.');
const effects = () => st().world.effects.filter(effect => /Legge di prova sui sondaggi/.test(effect.cause));
assert.equal(effects().length, 1, 'Il giudizio netto sposta il peso della maggioranza una volta sola.');
assert.ok(effects()[0].delta < 0 && effects()[0].strategy === 'governista' && effects()[0].remaining <= EXT.consequence.primo.weeks, 'In modo limitato (−0,25) e a termine.');
assert.ok(st().game.timeline.some(item => /Legge di prova sui sondaggi/.test(item.title ?? '')), 'La carriera lo registra, con la causa.');
store.advance(7);
assert.equal(effects().length <= 1, true, 'Le settimane dopo non accumulano un secondo effetto.');
for (let i = 0; i < 5; i++) store.advance(7);
assert.equal(effects().length, 0, 'L’effetto svanisce da solo.');
// The allies that had reservations lean away from a law the citizens reject (once), and the memory of the career keeps it.
{
  const parliamentEngine = await import(`../src/core/parliament-engine.js${v}`);
  const state = st();
  const partners = state.parliament.government.partners ?? {};
  const groupOf = id => ['camera', 'senato'].flatMap(chamber => state.parliament.chambers[chamber].groups).find(group => group.groupId === id);
  const entry = Object.keys(partners).map(id => ({ id, dislikes: parliamentEngine.groupProfile(groupOf(id) ?? id).dislikes })).find(item => item.dislikes.length);
  if (entry) {
    const area = entry.dislikes[0];
    const before = st().parliament.government.partners[entry.id].satisfaction;
    edit(save => { save.society.lawsApplied.unshift({ ...copy(law), lawId: 'legge-riserve', title: 'Legge con le riserve di un alleato', area, category: area, week: save.game.week.index, date: save.clock.currentDate, covered: false, deficit: 0.4, controversy: 1.2, origin: 'governo', winners: [], losers: segments.map(item => ({ id: item.id, label: item.label, delta: -2.2, reason: 'paga o perde con deficit' })) }); Object.assign(save.parliament.government, { stability: 90, status: 'active', crisisSeverity: 0 }); });
    store.advance(7); store.advance(7);
    const record = obsState().laws.find(item => item.lawId === 'legge-riserve');
    assert.ok(record?.surveys[0]?.verdict === 'contrari', 'La legge è bocciata dai cittadini.');
    const after = st().parliament.government.partners[entry.id]?.satisfaction;
    assert.ok(after === undefined || after < before + 1, 'L’alleato che aveva riserve non ne esce più soddisfatto.');
    const story = st().society.media.stories.find(item => item.key === 'legge:legge-riserve');
    assert.ok(story && story.timeline.some(item => /Sondaggio:/.test(item.text)) && story.reactions.length >= 1, 'La storia della legge ha le reazioni e il sondaggio: dal fatto alla redazione, dalla redazione ai sondaggi.');
  }
}
// A law of the opposition measured: nothing for the Government.
edit(save => { save.society.lawsApplied.unshift({ ...copy(law), lawId: 'legge-opposizione', title: 'Legge dell’opposizione', week: save.game.week.index, date: save.clock.currentDate, origin: 'opposizione', losers: segments.map(item => ({ id: item.id, label: item.label, delta: -2.2 })), winners: [] }); });
store.advance(7); store.advance(7);
assert.ok(obsState().laws.find(item => item.lawId === 'legge-opposizione')?.surveys[0]?.applied === true && st().world.effects.every(effect => !/dell’opposizione/.test(effect.cause)), 'Una legge dell’opposizione si misura ma non pesa sul Governo.');
// The newsroom tells it, and the story of the law gets its reaction.
const articles = st().society.media.articles.filter(item => item.key.startsWith('sondaggio:'));
assert.ok(articles.length >= 1 && articles.every(item => item.category === 'sondaggi' && item.body.join(' ').includes('Secondo la media di quattro istituti') && item.facts.some(fact => fact.label === 'Margine')), 'La redazione racconta il sondaggio con il suo margine.');
assert.ok(st().society.media.stories.some(item => item.kind === 'riforma' && item.timeline.some(entry => /Sondaggio:/.test(entry.text))), 'E lo aggiunge alla storia della legge.');
assert.ok(articles.every(item => item.tone !== 'good' || /promossa|approva/i.test(item.headline)), 'Il tono dell’articolo segue il verdetto.');
// Reading changes nothing: rendering every view leaves the state as it was.
const snapshot = JSON.stringify(st());
const options = { view: 'quadro', filters: {}, logoFor: () => null };
for (const view of ['quadro', 'territori', 'gradimento', 'scenari']) {
  const html = ui.renderObservatory(st(), { ...options, view, filters: { obsMembers: st().world.parties[1]?.id + ',' + st().world.parties[2]?.id, obsRegion: 'Lombardia' } });
  assert.ok(html.length > 400 && !bad(html), `Vista «${view}» senza valori vuoti.`);
}
assert.equal(JSON.stringify(st()), snapshot, 'Guardare i sondaggi e gli scenari non cambia la partita.');
const gradimento = ui.renderObservatory(st(), { ...options, view: 'gradimento' });
assert.ok(/Voto, gradimento, risultato/.test(gradimento) && /INTENZIONI DI VOTO/.test(gradimento) && /GRADIMENTO/.test(gradimento) && /RISULTATI/.test(gradimento), 'Intenzioni di voto, gradimento e risultati sono tre cose distinte, dette.');
assert.ok(/Governo e leader nel tempo/.test(gradimento) && /Legge di prova sui sondaggi/.test(gradimento) && /obs-law-bar/.test(gradimento) && /±/.test(gradimento) && /non è un voto/.test(gradimento), 'Il gradimento nel tempo e le leggi, con il margine e l’avvertenza.');
const scenari = ui.renderObservatory(st(), { ...options, view: 'scenari', filters: { obsMembers: [...st().world.parties.filter(party => party.active).slice(0, 3).map(party => party.id)].join(',') } });
assert.ok(/Da soli o in coalizione/.test(scenari) && /obs-range/.test(scenari) && /non sono risultati/.test(scenari) && /data-view-filter="obsMembers"/.test(scenari), 'Gli scenari dichiarano l’incertezza e che non sono risultati.');
const territori = ui.renderObservatory(st(), { ...options, view: 'territori', filters: { obsRegion: 'Lombardia' } });
assert.ok(/nel tempo/.test(territori) && /data-view-filter-select="obsRegion"/.test(territori), 'L’andamento regionale nel tempo ha la scelta della regione.');
// Save and reload; a save from before the extensions reads and goes on.
const saved = store.exportSave();
store.loadGame(JSON.parse(saved));
assert.equal(JSON.stringify(st().world.observatory.laws), JSON.stringify(JSON.parse(saved).world.observatory.laws), 'Dopo il ricaricamento le leggi misurate sono le stesse.');
assert.deepEqual(checkInvariants(st()).issues, [], 'Gli invarianti reggono.');
edit(save => { delete save.world.observatory.approval; delete save.world.observatory.regional; delete save.world.observatory.laws; });
store.advance(7); store.advance(7);
assert.ok(obsState().approval.length >= 1 && Array.isArray(obsState().laws), 'Un salvataggio senza le nuove serie le riceve.');
assert.deepEqual(checkInvariants(st()).issues, [], 'Invarianti dopo la migrazione.');
console.log('Osservatorio esteso verificato: quattro istituti A–D invariati; gradimento di Governo, esecutivo e leader nel tempo (distinto dal voto e dai risultati); andamento regionale ogni quattro settimane; approvazione delle singole leggi in due momenti, dagli effetti sui segmenti e da chi governa, con campione e margine del modello, deterministica; un giudizio netto su una legge del Governo pesa una volta sola, poco e a termine; coalizioni ipotetiche contro la corsa solitaria con perdita per distanza e rapporti e intervallo dichiarato; guardare non cambia la partita; salvataggi vecchi e nuovi coerenti.');
process.exit(0);
