// The words of the three television studios (data/studio-lines.js, core/studio-lines.js): every line a scene says is picked deterministically (the same scene says the same thing, two scenes do not),
// the three formats say different things, the questions follow the situation (a broken promise, the programme of the opponent, a fact of the days), and every line, in every format, is translated into
// English by the phrase book with no Italian left. Pure Node: the scenes are played through the engine, no browser.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
mem.set('politicando.settings.v1', JSON.stringify({ language: 'en' }));
const version = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const I = await import(`../src/core/i18n.js?v=${version}`);
await I.loadBook();
const E = await import(`../src/core/scene-engine.js?v=${version}`);
const { SHOWS } = E;
const { INDICATORS } = await import(`../src/data/simulation/society-rules.js?v=${version}`);
const player = { name: 'Giulia Rossetti', tag: 'Candidata · Partito del Lavoro' };
const base = (show, n, extra = {}) => E.withStats(E.createDebateScene({ id: `t${n}`, seed: `seed-${n}`, show, player, playerAvatar: null, rival: { id: 'rival-1', name: 'Marco Bellandi', partyId: 'p1', tag: 'Candidato · Alleanza Civica' }, host: { id: 'conduttore-Anna', name: 'Anna Lombardi', tag: 'Moderatrice' }, topic: { id: 'sanita', label: 'sanità' }, secondTopic: { id: 'lavoro', label: 'lavoro' }, promises: [{ id: 'a', label: 'Sanità', topic: 'sanita', status: 'in-corso' }, { id: 'b', label: 'Scuola', topic: 'scuola', status: 'non-mantenuta' }], credibility: 58, prep: 6, rivalProgram: ['lavoro'], rivalProgramLabels: ['il lavoro', 'la sanità'], rivalReadiness: 50, events: ['Si dimette un ministro: il Governo è costretto a rimpiazzarlo'], ticker: ['IN DIRETTA · Tema della serata: sanità'], ...extra }), { competence: 55, charisma: 55 });
const play = scene => { const texts = []; let current = scene; for (let guard = 0; guard < 40 && current.status === 'active'; guard++) { const node = E.sceneNode(current); texts.push(node.text, ...(node.lines ?? []), node.audience, node.title, ...node.choices.map(choice => choice[1])); const pick = node.choices.find(choice => !choice[2]); current = E.chooseInScene(current, pick[0]); } texts.push(E.sceneNode(current).text); return { texts: texts.filter(Boolean), scene: current }; };

// 1. the same scene says the same thing, two scenes say different things
const a1 = play(base('faccia-a-faccia', 1)).texts.join('|'), a2 = play(base('faccia-a-faccia', 1)).texts.join('|');
assert.equal(a1, a2, 'La stessa scena dice le stesse cose.');
const variety = new Set();
for (let n = 0; n < 30; n++) for (const text of play(base('faccia-a-faccia', 100 + n)).texts) variety.add(text);
assert.ok(variety.size > 60, `Le scene diverse dicono cose diverse (${variety.size} frasi distinte).`);
// 2. the three formats say different things (invitation, opening, closing)
const open = id => { const scene = base(id, 7); return [E.sceneNode(scene).text, E.sceneNode({ ...scene, nodeId: 'ingresso' }).text, E.sceneNode({ ...scene, nodeId: 'chiusura' }).text].join('|'); };
const byFormat = { faccia: open('faccia-a-faccia'), talk: open('prima-serata'), intervista: open('tg-sera') };
assert.equal(new Set(Object.values(byFormat)).size, 3, 'I tre formati parlano in modo diverso.');
assert.ok(E.sceneNode(base('tg-sera', 7)).text.includes('Il Telegiornale della Sera'), 'L’invito nomina il programma.');
// 3. the questions follow the situation
const questions = new Set();
for (let n = 0; n < 60; n++) questions.add(E.sceneNode({ ...base('salotto', 200 + n), nodeId: 'q2' }).text);
assert.ok([...questions].some(text => text.includes('Scuola')), 'Una promessa tradita diventa una domanda.');
assert.ok([...questions].some(text => text.includes('il lavoro') || text.includes('la sanità')), 'Il programma dell’avversario diventa una domanda.');
assert.ok([...questions].some(text => text.includes('Si dimette un ministro: il Governo è costretto a rimpiazzarlo')), 'Un fatto dei giorni diventa una domanda.');
const attacks = new Set();
for (let n = 0; n < 60; n++) { const scene = { ...base('faccia-a-faccia', 300 + n), nodeId: 'q2' }; let step = E.chooseInScene(scene, 'dati'); step = E.chooseInScene({ ...step, nodeId: 'r2' }, 'continua'); attacks.add(E.sceneNode(step).text); }
assert.ok(attacks.size >= 3, `L’attacco dell’avversario non è sempre lo stesso (${attacks.size}).`);
// the rival attacks the proposal of the programme that has no funding
const weakAttacks = new Set();
for (let n = 0; n < 80; n++) { const scene = { ...base('faccia-a-faccia', 500 + n, { weakProposal: 'Sussidio per tutti' }), nodeId: 'r2' }; weakAttacks.add(E.sceneNode(E.chooseInScene({ ...scene, nodeId: 'q2' }, 'dati') && E.chooseInScene(E.chooseInScene({ ...scene, nodeId: 'q2' }, 'dati'), 'continua')).text); }
assert.ok([...weakAttacks].some(text => text.includes('Sussidio per tutti')), 'Una proposta senza copertura diventa un attacco dell’avversario.');
// 4. the English: every line of every format has its translation, with no Italian left
let counted = 0;
for (const show of Object.keys(SHOWS)) for (let n = 0; n < 12; n++) {
  const { texts } = play(base(show, 400 + n));
  for (const text of texts) {
    if (text.length < 4) continue;
    const english = I.translateText(text);
    counted++;
    assert.notEqual(english, text, `Riga non tradotta: «${text}»`);
    assert.equal(I.residualItalian(english), null, `Italiano residuo in «${english}» (da «${text}»)`);
  }
}
for (const show of Object.values(SHOWS)) for (const text of [show.name, show.slot, `${show.name}: sanità`]) assert.equal(I.residualItalian(I.translateText(text)), null, `Programma non tradotto: ${text}`);
console.log(`check-studio-lines: ok (${variety.size} frasi distinte, ${counted} righe tradotte)`);

// 5. the rallies: the same, with the situation of the game (broken promise, a late work, a cut): every line said in the square is translated and a protest has a reason of the game
const rallyContext = { stats: { competence: 55, charisma: 55, reputation: 50, notoriety: 40 }, credibility: 60, promises: [{ id: 'p', area: 'sanita', label: 'Sanità', status: 'non-mantenuta', intervention: 'Investimento in sanità' }, { id: 'q', area: 'lavoro', label: 'Lavoro', status: 'in-corso', intervention: 'Investimento in lavoro' }], programAreas: ['ambiente'], territory: { name: 'Lazio', trust: 25, problems: [{ id: 'sanita', area: 'sanita', label: INDICATORS[0].label, severity: 30 }] }, economy: { inflation: 5, growth: 0.2 }, events: [], relations: { civic: 50 }, protestLevel: 1, rallyMemory: [], triggers: [{ kind: 'tagli', area: 'sanita', label: 'i tagli a sanità', weight: 1.6 }] };
let rallyTexts = 0, protests = 0; const missing = new Set();
for (let n = 0; n < 24; n++) {
  let scene = E.createRallyScene({ id: `r${n}`, seed: `rally-${n}`, player: { name: 'Giulia Rossetti' }, playerAvatar: null, party: { name: 'Futuro Nazionale' }, place: { municipality: 'Roma', region: 'Lazio' }, context: rallyContext });
  for (let guard = 0; guard < 30 && scene.status === 'active'; guard++) {
    const node = E.sceneNode(scene);
    for (const text of [node.text, node.title, node.said, node.audience, ...(node.preface ?? []), ...(node.lines ?? []), ...node.choices.flatMap(choice => [choice[1], choice[3]])].filter(Boolean)) {
      if (text.length < 4) continue;
      const english = I.translateText(text);
      rallyTexts++;
      if (I.residualItalian(english.replaceAll('Roma', 'Rome')) !== null) missing.add(text);
    }
    if (scene.protest?.reason) protests++;
    const pick = node.choices.find(choice => !choice[2]); if (!pick) break;
    scene = E.chooseInScene(scene, pick[0]);
  }
}
assert.equal(missing.size, 0, `Comizio: righe con italiano residuo:\n${[...missing].slice(0, 40).join('\n')}`);
assert.ok(protests > 0, 'Almeno un comizio ha una contestazione motivata da un fatto del gioco.');
console.log(`check-studio-lines: comizio ok (${rallyTexts} righe tradotte)`);
