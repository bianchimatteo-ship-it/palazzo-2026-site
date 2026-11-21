// The variety of the animated scenes of ALL the weekly activities with a scene (62): thirty weeks, three deterministic seeds, measured per activity (scripts/measure-scene-variety.mjs): casts (roles of the
// guests and of the person in the room), names, openings, dialogues, reactions and gesture sequences; the most common one must not dominate. Plus: the room has its ambience, the bystander reacts, every new text is
// a bilingual pair, and the same scene always comes out the same (deterministic).
import assert from 'node:assert/strict';
import { measure, SEEDS, WEEKS } from './measure-scene-variety.mjs';
import { ALL_PAIRS, AMBIENCE, ATMOSPHERE, BYSTANDERS, LEADIN, ambienceOf } from '../src/data/activity-scene-variety.js';
const result = measure();
const ids = Object.keys(result);
assert.ok(ids.length >= 62, `tutte le attività con scena (${ids.length})`);
let worst = { openings: 0, casts: 0, dialogues: 0, reactions: 0 };
for (const [id, r] of Object.entries(result)) {
  assert.equal(r.scenes, SEEDS.length * WEEKS, `${id}: ${SEEDS.length} semi × ${WEEKS} settimane`);
  assert.ok(r.openings.distinct >= 6 && r.openings.top <= 30, `${id}: aperture diverse (${r.openings.distinct}, la più frequente ${r.openings.top}%)`);
  assert.ok(r.casts.distinct >= 20 && r.casts.top <= 20, `${id}: gruppi di personaggi diversi (${r.casts.distinct}, il più frequente ${r.casts.top}%)`);
  assert.ok(r.names >= 14, `${id}: nomi diversi (${r.names})`);
  assert.ok(r.dialogues.distinct >= 40 && r.dialogues.top <= 10, `${id}: dialoghi diversi (${r.dialogues.distinct}, il più frequente ${r.dialogues.top}%)`);
  assert.ok(r.reactions.distinct >= 18 && r.reactions.top <= 30, `${id}: reazioni diverse (${r.reactions.distinct}, la più frequente ${r.reactions.top}%)`);
  assert.ok(r.gestures.distinct >= 60 && r.gestures.top <= 10, `${id}: sequenze di gesti diverse (${r.gestures.distinct})`);
  assert.ok(r.families.distinct >= 6, `${id}: temi diversi (${r.families.distinct})`);
  worst.openings = Math.max(worst.openings, r.openings.top); worst.casts = Math.max(worst.casts, r.casts.top); worst.dialogues = Math.max(worst.dialogues, r.dialogues.top); worst.reactions = Math.max(worst.reactions, r.reactions.top);
}
// the data: every kind of room has its atmospheres, lines of the room and bystanders, all bilingual; every activity has an ambience
for (const key of ['associazioni', 'cantiere', 'sede', 'commissione', 'redazione', 'consiglio', 'mercato']) {
  assert.ok(ATMOSPHERE[key].length >= 8 && LEADIN[key].q1.length >= 5 && LEADIN[key].q2.length >= 5 && BYSTANDERS[key].length >= 6, `${key}: voci sufficienti`);
}
for (const [it, en] of ALL_PAIRS) assert.ok(it && en && it !== en, `coppia bilingue: ${it}`);
assert.equal(new Set(ALL_PAIRS.map(pair => pair[0])).size, ALL_PAIRS.length, 'nessun testo ripetuto');
for (const id of ids) assert.ok(Object.keys(AMBIENCE).includes(ambienceOf(id)), `${id}: ambiente`);
assert.equal(new Set(Object.values(AMBIENCE).flat()).size, Object.values(AMBIENCE).flat().length, 'ogni attività ha un solo ambiente');
// deterministic: the same measure twice gives the same numbers
assert.deepEqual(measure()[ids[7]], result[ids[7]], 'la misura è deterministica');
console.log(`Varietà delle scene: ${ids.length} attività × ${SEEDS.length} semi × ${WEEKS} settimane. Caso peggiore: apertura più frequente ${worst.openings}%, gruppo di personaggi ${worst.casts}%, dialogo ${worst.dialogues}%, reazione ${worst.reactions}%.`);
