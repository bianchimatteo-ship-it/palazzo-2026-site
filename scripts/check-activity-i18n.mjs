// The English of the activity encounters, without a browser: every text the scenes can show (the moments, the moves and what they do, the reactions, the second voice, the outcomes and what they leave, the
// reasons) for the seven kinds of encounter, over many seeds and different decisions, goes through the real phrase-book and the independent detector of Italian left over. The names of the people are not counted.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const mem = new Map(); globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
mem.set('politicando.settings.v1', JSON.stringify({ language: 'en' }));
const build = readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/main\.js\?v=([^"']+)/)[1];
const load = path => import(new URL(`../${path}?v=${build}`, import.meta.url).href);
const i18n = await load('src/core/i18n.js'); await i18n.loadBook?.();
const { createIndependentDetector } = await import('./lib/i18n-independent.mjs');
const { ACTIVITY_SCENES, SCENE_KEYS, createActivityScene } = await load('src/core/activity-scenes.js');
const { chooseInScene, sceneNode } = await load('src/core/scene-engine.js');
const detector = createIndependentDetector();
const problems = new Map();
const check = (text, where, names) => {
  if (!text || typeof text !== 'string') return;
  const shown = i18n.translateText(text);
  const clean = names.reduce((acc, name) => acc.split(name).join(''), shown);
  const reason = detector.reasonOf(clean);
  if (reason) problems.set(text, `${where}: ${shown.slice(0, 120)} (${reason})`);
  assert.ok(shown !== undefined);
};
const FULL = { promise: true, prior: true, govern: true, funds: true, capital: true, party: true };
let texts = 0;
for (const key of [...SCENE_KEYS, 'cittadini']) {
  const sceneKey = key === 'cittadini' ? 'associazioni' : key;
  for (let seed = 0; seed < 14; seed++) for (const pickOffset of [0, 1, 2, 3]) {
    let scene = createActivityScene({ id: `i-${key}-${seed}`, seed: `${key}-${seed}`, sceneKey, activityId: key === 'cittadini' ? 'cittadini' : ACTIVITY_SCENES[sceneKey].activityIds[0], variant: seed % 2 && sceneKey === 'cantiere' ? 'opposition' : 'default', player: { name: 'Anna Verdi', tag: 'Deputata' }, playerAvatar: null, situation: seed % 3 ? FULL : { funds: true }, refs: { promise: 'Più medici di base', news: 'Un imprenditore offre un contributo', region: 'Toscana', rival: 'Azione', party: 'Il Mio Partito' }, party: { label: 'Il Mio Partito' } });
    const names = [...scene.cast.map(item => item.name).filter(Boolean), 'Più medici di base', 'Il Mio Partito', 'Un imprenditore offre un contributo'];
    let step = 0;
    for (let guard = 0; guard < 16 && scene.status === 'active'; guard++) {
      const node = sceneNode(scene);
      const here = `${key}/${scene.nodeId}`;
      for (const text of [node.title, node.text, node.kind, node.said, ...(node.preface ?? []), ...(node.lines ?? []), ...(node.why ?? []), ...(node.exchange ?? []).map(item => item.text), ...node.choices.flatMap(choice => [choice[1], choice[3]])]) { check(text, here, names); texts++; }
      const options = node.choices.filter(choice => !choice[2]);
      scene = chooseInScene(scene, node.choices.length === 1 ? node.choices[0][0] : options[(pickOffset + step++ + seed) % options.length][0]);
    }
    const end = sceneNode(scene);
    for (const text of [end.title, end.text, ...(end.preface ?? []), ...(end.lines ?? [])]) { check(text, `${key}/esito`, names); texts++; }
  }
}
// the polls page: the headline and the notes are made of separate pieces (a party name, «al 8,4%», what changed, the margin, the source), each one a text of its own
for (const text of ['al 8,4%', 'al 12%', 'rispetto al sondaggio precedente', 'margine d’errore ±2,9 punti', 'media di più sondaggi reali', 'il tuo partito non è nella fonte reale: stima iniziale simulata', 'non ancora rilevato dagli istituti: stima interna simulata', 'Dato reale:', 'dal 3 al 5 novembre', '5 novembre 2026', 'media di più istituti (nessun margine d’errore unico).', 'Le variazioni sono quelle pubblicate dalla fonte, rispetto alla sua Supermedia precedente.', 'Sono mostrate solo le forze presenti nella fonte, con “Altri” come nella fonte.', 'La barra tratteggiata è una stima simulata del tuo partito, fuori dal totale reale.', 'Dalla prossima settimana i sondaggi sono simulati e reagiscono alla tua carriera.']) { check(text, 'sondaggi', []); texts++; }
assert.match(i18n.translateText('al 8,4%'), /^at 8\.4%$/); assert.equal(i18n.translateText('rispetto al sondaggio precedente'), 'compared with the previous poll'); assert.equal(i18n.translateText('margine d’errore ±2,9 punti'), 'margin of error ±2.9 points');
for (const [text, detail] of problems) console.log(`${detail}\n   ← ${text.slice(0, 140)}`);
assert.equal(problems.size, 0, `Italiano rimasto in inglese nelle scene (${problems.size}).`);
console.log(`Le scene in inglese sono verificate senza browser: ${texts} testi di sette incontri (momenti, mosse, reazioni, seconda voce, esiti, conseguenze) passano dal libro delle frasi e dal rilevatore indipendente.`);
