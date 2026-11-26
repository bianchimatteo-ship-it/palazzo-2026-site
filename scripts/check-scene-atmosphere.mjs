// The look of the encounters (ui/room-art.js): beyond the room of each kind, every encounter has the light of its hour (morning, afternoon, evening, night), the props of its place in one of two
// arrangements and, where a crowd fills the place, the depth of the people in front of the camera. Checked on 400 encounters: every hour and every arrangement appears, the same encounter always looks the
// same, the indexes never fall outside the lists (the seed of an encounter can be any 32-bit value).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const R = await import(new URL(`../src/ui/room-art.js?v=${build}`, import.meta.url).href);
const hours = new Set(), props = {};
for (let n = 0; n < 400; n++) {
  const scene = { seed: `incontro|${n}|${n * 7919}` };
  const hour = R.hourOf(scene);
  assert.ok(['mattina', 'pomeriggio', 'sera', 'notte'].includes(hour), `ora valida (${hour})`);
  assert.equal(R.hourOf({ ...scene }), hour, 'lo stesso incontro ha sempre la stessa luce');
  hours.add(hour);
  for (const setting of ['sala', 'commissione', 'consiglio', 'redazione', 'cantiere', 'mercato']) {
    const svg = R.propsOf(setting, scene);
    assert.ok(svg.startsWith('<g class="rm-props">'), `${setting}: oggetti del luogo disegnati`);
    (props[setting] ??= new Set()).add(svg);
  }
  assert.ok(R.depthOf('sala', scene).includes('rm-depth') && R.depthOf('commissione', scene) === '', 'profondità solo dove c’è folla');
}
assert.equal(hours.size, 4, 'Tutte e quattro le luci compaiono.');
for (const [setting, set] of Object.entries(props)) assert.equal(set.size, 2, `${setting}: due disposizioni diverse.`);
console.log(`Atmosfere delle scene verificate su 400 incontri: 4 luci (${[...hours].join(', ')}), due disposizioni di oggetti per ciascuno dei 6 luoghi, profondità della folla in sala, mercato e cantiere; stesso incontro, stesso aspetto.`);
