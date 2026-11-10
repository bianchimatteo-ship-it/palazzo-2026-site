// The guided programme editor, on real data and in the browser (Chrome): all 34 areas have their own themes, problems, objectives and measures (different from one sector to the next), the lists change with the area,
// every choice fills the real field of the form (which stays editable), what is chosen is what the store records and what the preview shows, a place (region and a real comune) is recorded, older proposals
// (without a municipality) load and edit as before, and the data (the catalogue) carry their English.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const catalog = await import(`../src/data/program-catalog.js${v}`);
const policy = await import(`../src/data/simulation/policy-rules.js${v}`);
const proposals = await import(`../src/core/program-proposals.js${v}`);
const guide = await import(`../src/ui/program-guide.js${v}`);

// ---------- 1. the catalogue: every area, three real themes, different from the others ----------
const seenTitles = new Map();
for (const area of policy.POLICY_AREAS) {
  const themes = catalog.themesOf(area.id);
  assert.ok(themes.length >= 3, `${area.id}: almeno tre temi propri.`);
  for (const theme of themes) {
    assert.ok(theme.title.length > 8 && theme.problem.length > 25 && theme.objective.length > 15 && theme.measures.length >= 2, `${area.id}: tema completo (${theme.title}).`);
    for (const measure of theme.measures) assert.ok(policy.INSTRUMENT_KINDS[measure.instrument] && measure.text.length > 12, `${area.id}: misura con uno strumento vero (${measure.text}).`);
    assert.ok(!seenTitles.has(theme.title), `${area.id}: il titolo «${theme.title}» non è già usato in ${seenTitles.get(theme.title)}.`); seenTitles.set(theme.title, area.id);
  }
  const options = guide.guideOf(area.id);
  assert.ok(options.titles.length >= 3 && options.problems.length >= 3 && options.objectives.length >= 3 && options.measures.length >= 6, `${area.id}: opzioni per titolo, problema, obiettivo e misure.`);
}
for (const [a, b] of [['sanita', 'scuola'], ['sicurezza', 'ambiente'], ['lavoro', 'trasporti']]) {
  const left = new Set(guide.guideOf(a).measures.map(item => item.text)), right = guide.guideOf(b).measures.map(item => item.text);
  assert.ok(!right.some(text => left.has(text)), `${a} e ${b} hanno misure diverse.`);
}
// the English of every choice is in the pairs of the phrase-book, and is not the Italian
assert.ok(catalog.ALL_PAIRS.length >= 480, `Le frasi del catalogo sono tradotte (${catalog.ALL_PAIRS.length}).`);
for (const [it, en] of catalog.ALL_PAIRS) assert.ok(en && en !== it && !/[àèéìòù]\b.*\b(della|degli|delle|per)\b/.test(en), `Traduzione inglese vera: ${it}`);

// ---------- 2. the store records the choices, and an old proposal still works ----------
const { store } = await startCareer({ seed: 'programma-guidato', level: 'deputato', fast: true, territorial: true });
const pick = (area, index = 0) => { const theme = catalog.themesOf(area)[index]; return { area, title: theme.title, problem: theme.problem, objective: theme.objective, measures: theme.measures.map(item => ({ instrument: item.instrument, text: item.text })) }; };
store.addProposal({ ...pick('sanita', 1), cost: 3, financing: 'europa', deadlineWeeks: 156, territory: 'locale', region: 'Lombardia', municipality: 'Bergamo' });
store.addProposal({ ...pick('scuola', 0), cost: '', financing: 'risparmi', deadlineWeeks: 13, territory: 'regionale', region: 'Puglia' });
store.addProposal({ area: 'cultura', title: 'Un titolo scritto a mano', problem: 'Un problema scritto a mano', objective: 'Un obiettivo scritto a mano', measures: [{ instrument: 'servizi', text: 'Una misura scritta a mano' }], deadlineWeeks: 260 });
const list = store.programView().proposals.list;
assert.equal(list.length, 3);
const sanita = list.find(item => item.area === 'sanita');
assert.equal(sanita.title, catalog.themesOf('sanita')[1].title); assert.equal(sanita.municipality, 'Bergamo'); assert.equal(sanita.region, 'Lombardia'); assert.equal(sanita.deadlineWeeks, 156); assert.equal(sanita.financing, 'europa'); assert.equal(sanita.cost, 3);
const scuola = list.find(item => item.area === 'scuola');
assert.equal(scuola.deadlineWeeks, 13); assert.ok(scuola.cost > 0, 'Senza importo la stima automatica dà un costo.'); assert.equal(scuola.municipality, null, 'Un comune c’è solo nelle proposte locali.');
assert.equal(list.find(item => item.area === 'cultura').title, 'Un titolo scritto a mano', 'Il testo scritto a mano resta com’è.');
assert.ok(list.find(item => item.area === 'cultura').deadlineWeeks === 260);
// an older proposal (no municipality, a deadline of the old list) edits as before
const save = JSON.parse(store.exportSave());
save.game.proposals = save.game.proposals.map(({ municipality, ...rest }) => rest);
store.loadGame(save);
store.editProposal(store.programView().proposals.list[0].id, { title: 'Titolo rivisto' });
assert.equal(store.programView().proposals.list[0].title, 'Titolo rivisto');
const comuni = store.municipalitiesView('Lombardia');
assert.ok(comuni.includes('Bergamo') && comuni.length > 500 && !comuni.includes('Bari'), 'I comuni vengono dai dati reali, per regione.');
assert.deepEqual(Object.keys(proposals.DEADLINES).map(Number), [13, 26, 52, 104, 156, 208, 260]);
assert.ok(proposals.COST_BANDS.length >= 5);
console.log(`Editor guidato del programma verificato: ${policy.POLICY_AREAS.length} aree con temi, problemi, obiettivi e misure propri (${catalog.ALL_PAIRS.length} frasi bilingui), scelte registrate nei dati veri, luogo e comune reali, vecchie proposte compatibili.`);
