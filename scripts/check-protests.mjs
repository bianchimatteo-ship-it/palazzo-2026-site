// The protests of a rally have a checkable cause in the game: who protests, for which problem, where, which indicator or promise is involved and why it is current. With no such cause there is no protest
// at all (no generic «discontent»). Many seeds and many situations: every protest has its five facts, the facts name the real promise / problem / indicator of the situation, and the scene shows them.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const load = path => import(new URL(`../${path}?v=${build}`, import.meta.url).href);
const { createRallyScene, chooseInScene, sceneNode } = await load('src/core/scene-engine.js');
const { protestEvidence } = await load('src/core/rally-scene.js');
const { defaultAvatarFor } = await load('src/core/avatar.js');
const avatar = defaultAvatarFor('prova');
const base = { stats: { competence: 60, charisma: 58, reputation: 55, notoriety: 45 }, credibility: 62, promises: [], programAreas: ['sanita'], territory: { name: 'Toscana', trust: 40, problems: [] }, economy: { inflation: 2, growth: 1 }, events: [], relations: { civic: 58 }, protestLevel: 1, rallyMemory: [], memoryBad: 0, governing: false, triggers: [] };
const make = (seed, over = {}) => createRallyScene({ id: `c-${seed}`, seed, player: { name: 'Mario Rossi' }, playerAvatar: avatar, party: { id: 'p', name: 'Futuro Nazionale' }, place: { municipality: 'Siena', region: 'Toscana' }, mode: 'settimana', context: { ...base, ...over } });
const FIVE = ['Chi protesta', 'Per quale problema', 'Dove', 'Indicatore o promessa', 'Perché adesso'];
// ---- 1. no reason, no protest: whatever the seed and however high the general tension
let planned = 0;
for (let n = 0; n < 300; n++) { const scene = make(`vuoto-${n}`); if (scene.protest.planned || scene.protest.reason) planned++; }
assert.equal(planned, 0, 'Senza un motivo verificabile nessuna protesta viene generata (nemmeno con la tensione al massimo).');
// ---- 2. every situation with a cause gives protests with the five facts, naming the real cause
const situations = [
  ['promessa tradita', { promises: [{ id: 'p1', area: 'scuola', label: 'Mense scolastiche gratuite', status: 'non-mantenuta' }] }, /Mense scolastiche gratuite/, /non mantenuta/],
  ['problema del territorio', { territory: { name: 'Toscana', trust: 35, problems: [{ id: 'sanita', area: 'sanita', label: 'Liste d’attesa in sanità', severity: 31 }] } }, /Liste d’attesa in sanità: gravità 31/, /problemi più gravi/],
  ['caro vita', { economy: { inflation: 5.2, growth: 0.2 } }, /inflazione al 5,2%/, /sopra il 4,5%/],
  ['governo impopolare', { governing: true, government: { approval: 33 } }, /gradimento del Governo 33\/100/, /sotto la soglia/],
  ['polemiche recenti', { memoryBad: 3 }, /3 episodi negativi/, /registro|decisioni/],
  ['opera in ritardo', { triggers: [{ kind: 'opera', area: null, label: 'l’opera «Ponte sul fiume» ferma da 12 settimane', weight: 2 }] }, /ritardo/, /documentata nel diario/]
];
for (const [name, over, indicator, why] of situations) {
  let count = 0;
  for (let n = 0; n < 120; n++) {
    const scene = make(`${name}-${n}`, over);
    if (!scene.protest.planned) continue;
    count++;
    const e = scene.protest.reason.evidence;
    assert.ok(e && ['who', 'problem', 'where', 'indicator', 'why'].every(key => String(e[key] ?? '').trim().length >= 5), `${name}: i cinque fatti ci sono (${JSON.stringify(e)})`);
    assert.equal(e.where, 'Toscana', `${name}: il luogo è quello della situazione`);
    // the facts are the ones of the situation
    if (scene.protest.reason.kind === (name === 'promessa tradita' ? 'promessa' : name === 'problema del territorio' ? 'territorio' : name === 'caro vita' ? 'economia' : name === 'governo impopolare' ? 'governo' : name === 'polemiche recenti' ? 'memoria' : 'opera')) { assert.match(e.indicator, indicator, `${name}: l’indicatore nomina la cosa reale`); assert.match(e.why, why, `${name}: dice perché è attuale`); }
  }
  assert.ok(count >= 8, `${name}: la protesta compare con una certa frequenza (${count}/120).`);
}
// ---- 3. the scene shows the five facts at the moment of the protest
{
  let shown = 0;
  for (let n = 0; n < 200 && !shown; n++) {
    let scene = make(`scena-${n}`, { promises: [{ id: 'p1', area: 'scuola', label: 'Mense scolastiche gratuite', status: 'non-mantenuta' }], territory: { name: 'Toscana', trust: 35, problems: [{ id: 'sanita', area: 'sanita', label: 'Liste d’attesa in sanità', severity: 31 }] } });
    if (!scene.protest.planned) continue;
    for (let guard = 0; guard < 12 && scene.status === 'active'; guard++) {
      const node = sceneNode(scene);
      if (node.id === 'contestazione') { assert.deepEqual(node.facts.map(row => row[0]), FIVE, 'La scena mostra i cinque fatti.'); assert.ok(node.facts.every(row => row[1].length > 3)); assert.ok(!/malcontento sul territorio/.test(node.text), 'Nessuna contestazione generica nel testo.'); shown++; break; }
      scene = chooseInScene(scene, node.choices.find(choice => !choice[2])[0]);
    }
  }
  assert.ok(shown, 'Almeno una scena con la contestazione è stata percorsa.');
}
// ---- 4. the evidence follows the cause kind (pure function)
assert.match(protestEvidence({ kind: 'economia', area: 'costo-vita', label: 'il caro vita' }, { ...base, economy: { inflation: 6, growth: 0 } }).indicator, /6%/);
console.log('Proteste verificate: nessuna protesta senza un motivo concreto (300 comizi senza cause), cinque fatti (chi, problema, luogo, indicatore o promessa, perché adesso) per ogni protesta in sei situazioni diverse, mostrati nella scena.');
