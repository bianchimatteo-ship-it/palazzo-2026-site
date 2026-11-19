// The preview of a news article is clipped at the end of a sentence or of a clause, never in the middle of a phrase (the cut left Italian half-clauses in the English page).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const { clipAtBoundary } = await import(new URL(`../src/ui/news-view.js?v=${build}`, import.meta.url).href);
const gov = 'Governo in carica all’avvio ha la fiducia di 6 gruppi; la stabilità è a 50/100 e il margine nella Camera più stretta è di +12 seggi. Programma di governo: crescita e investimenti · priorità sicurezza, natalità e demografia e giustizia. Reazioni degli alleati: Fratelli d’Italia +1; Lega +2; Forza Italia +1.';
for (let limit = 60; limit <= 260; limit++) {
  const out = clipAtBoundary(gov, limit);
  assert.ok(out.length <= limit + 1, `limite ${limit}: ${out.length}`);
  assert.ok(/[.!?…]$/.test(out) || out === gov, `limite ${limit}: finisce a fine frase o con i puntini («${out.slice(-20)}»)`);
  assert.ok(!/(è di \+?…?|di \+)$/.test(out), `limite ${limit}: non taglia a metà della proposizione sul margine`);
  assert.equal(clipAtBoundary(out, limit), out, `limite ${limit}: tagliare di nuovo non cambia`);
}
assert.equal(clipAtBoundary('Breve.', 220), 'Breve.'); assert.equal(clipAtBoundary('', 220), '');
assert.ok(clipAtBoundary('parola '.repeat(80), 100).endsWith('…'), 'Senza confini di frase taglia a fine parola con i puntini.');
console.log('Anteprime delle notizie: tagliate a fine frase o proposizione, mai a metà.');
