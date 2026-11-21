// Pro, contro, effect and cost on EVERY decision of every kind of scene (debate, rally, the activity scenes), read from the terms the engines apply. The navigation buttons («continua», «fine») have none.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// the modules are loaded with the stamp of the build, as the game does (the activity scenes register themselves in the same instance of the scene engine the game uses)
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const load = path => import(new URL(`../${path}?v=${build}`, import.meta.url).href);
const { chooseInScene, createDebateScene, sceneNode, withStats, createRallyScene } = await load('src/core/scene-engine.js');
const { ACTIVITY_SCENES, SCENE_KEYS, createActivityScene } = await load('src/core/activity-scenes.js');
const { normalizeAvatar } = await load('src/core/avatar.js');
const avatar = normalizeAvatar({ face: 'femminile', skin: 'oliva', hair: 'rosso', hairstyle: 'ondulato', beard: 'nessuna', glasses: 'tondi', jacket: 'bordeaux', eyes: 'verdi', expression: 'sorridente' });
const NAV = new Set(['continua', 'fine', 'rifiuta', 'accetta']);
let decisions = 0; const kinds = {};
const audit = (scene, label) => {
  let guard = 0;
  while (scene.status === 'active' && guard++ < 40) {
    const node = sceneNode(scene);
    if (!node.choices) break;
    for (const choice of node.choices) {
      if (NAV.has(choice[0]) && !choice[4]) continue;
      const odds = choice[4];
      assert.ok(odds, `${label}/${node.id}/${choice[0]}: manca pro e contro.`);
      assert.ok(odds.pro.length + odds.contro.length >= 1, `${label}/${node.id}/${choice[0]}: nessuna riga.`);
      assert.ok(Array.isArray(odds.effect) && Array.isArray(odds.cost), `${label}/${node.id}/${choice[0]}: effetto e costo devono esistere (anche vuoti).`);
      kinds[label] = (kinds[label] ?? 0) + 1; decisions++;
    }
    const pick = node.choices.find(c => !c[2]);
    scene = chooseInScene(scene, pick[0]);
  }
};
const mkDebate = seed => withStats(createDebateScene({ id: 'd-' + seed, seed, player: { name: 'Anna Rossi' }, playerAvatar: avatar, rival: { id: 'riv-1', name: 'Luca Bianchi', partyId: 'p1' }, host: { id: 'conduttore-1', name: 'Marco Valenti' }, topic: { id: 'sanita', label: 'Sanità' }, secondTopic: { id: 'lavoro', label: 'Lavoro e sviluppo' }, salientTopic: 'sanita', promises: [{ id: 'pr1', label: 'Sanità', topic: 'sanita', status: 'non-avviata', intervention: 'Investimento in sanità', cost: 3 }], credibility: 70, prep: 10, rivalProgram: ['sanita', 'fisco', 'lavoro'], rivalReadiness: 40, rivalAggression: 60 }), { competence: 70, charisma: 60 });
const ctx = (extra = {}) => ({ stats: { competence: 60, charisma: 58, reputation: 55, notoriety: 45 }, credibility: 62,
  promises: [{ id: 'p1', area: 'sanita', label: 'Sanità', status: 'in-corso', intervention: 'più medici nei pronto soccorso' }, { id: 'p2', area: 'scuola', label: 'Scuola', status: 'non-mantenuta', intervention: 'mense scolastiche gratuite' }],
  programAreas: ['sanita', 'scuola', 'lavoro'], territory: { name: 'Lazio', trust: 40, problems: [{ id: 'sanita', area: 'sanita', label: 'Liste d’attesa in sanità', severity: 18 }] },
  economy: { inflation: 4.2, growth: 0.3 }, events: ['Nuovo decreto sui bollettini'], relations: { civic: 58 }, protestLevel: 0.7, rallyMemory: [], ...extra });
const mkRally = seed => createRallyScene({ id: `comizio-${seed}`, seed, player: { name: 'Mario Rossi' }, playerAvatar: avatar, party: { id: 'p', name: 'Futuro Nazionale' }, place: { municipality: 'Roma', region: 'Lazio' }, mode: 'settimana', context: ctx() });
const player = { name: 'Anna Verdi', tag: 'Deputata · Rotta Civica' };
const mkActivity = (kind, n) => createActivityScene({ id: `a-${kind}-${n}`, seed: `odds|${kind}|${n}`, sceneKey: kind, activityId: ACTIVITY_SCENES[kind].activityIds[0], player, playerAvatar: null, party: { label: 'Rotta Civica' }, refs: {}, pool: ['Gruppo Uno', 'Gruppo Due'] });
for (const seed of ['s1', 's2', 's3']) audit(mkDebate(seed), 'dibattito');
for (const seed of ['r1', 'r2', 'r3', 'r4']) audit(mkRally(seed), 'comizio');
for (const kind of SCENE_KEYS) for (let n = 0; n < 3; n++) audit(mkActivity(kind, n), `attività-${kind}`);
for (const label of ['dibattito', 'comizio', ...SCENE_KEYS.map(k => `attività-${k}`)]) assert.ok(kinds[label] >= 6, `${label}: almeno sei decisioni con pro e contro (${kinds[label] ?? 0}).`);
// the lines follow the situation: the same move reads differently with other stats / a broken promise
{
  const strong = createRallyScene({ id: 'x', seed: 'x1', player: { name: 'M' }, playerAvatar: avatar, party: { id: 'p', name: 'F' }, place: { municipality: 'Roma', region: 'Lazio' }, mode: 'settimana', context: ctx({ stats: { competence: 60, charisma: 90, reputation: 55, notoriety: 45 } }) });
  const weak = createRallyScene({ id: 'x', seed: 'x1', player: { name: 'M' }, playerAvatar: avatar, party: { id: 'p', name: 'F' }, place: { municipality: 'Roma', region: 'Lazio' }, mode: 'settimana', context: ctx({ stats: { competence: 60, charisma: 20, reputation: 55, notoriety: 45 } }) });
  let a = strong, b = weak; for (const id of ['arrivo', 'cammino']) { a = chooseInScene(a, 'continua'); b = chooseInScene(b, 'continua'); }
  const oddsOf = sc => sceneNode(sc).choices.find(c => c[0] === 'caloroso')[4];
  assert.match(oddsOf(a).pro.join(' '), /carisma 90/); assert.match(oddsOf(b).contro.join(' '), /carisma 20/);
}
// the activity moves tell their costs: a funding move shows the money, a promise shows the deadline
{
  let seen = { fund: false, commit: false };
  for (const kind of SCENE_KEYS) for (let n = 0; n < 6; n++) { let sc = mkActivity(kind, n + 10), g = 0; while (sc.status === 'active' && g++ < 30) { const node = sceneNode(sc); for (const c of node.choices) { if (c[4]?.cost.some(t => /€ dai fondi/.test(t))) seen.fund = true; if (c[4]?.cost.some(t => /settimane/.test(t))) seen.commit = true; } sc = chooseInScene(sc, node.choices.find(c => !c[2])[0]); } }
  assert.ok(seen.commit, 'Almeno una mossa mostra l’impegno con la scadenza in settimane.');
}
console.log(`Pro, contro, effetto e costo su tutte le famiglie di scene verificati: ${decisions} decisioni (${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(', ')}).`);
