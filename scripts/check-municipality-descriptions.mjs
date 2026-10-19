// Le descrizioni delle fasce dei comuni dicono soglia e popolazione, non promettono né il ballottaggio né il premio di maggioranza come automatici, dichiarano la semplificazione
// dei seggi e rimandano a un documento che elenca i riferimenti normativi (con l'avvertenza che il testo vigente va verificato).
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const rules = await import(`../src/core/municipal-rules.js${v}`);
const doc = JSON.parse(await readFile(new URL('../src/data/real/municipal-population.json', import.meta.url), 'utf8'));
const index = rules.indexMunicipalPopulation(doc);
const small = rules.municipalityBandInfo('001001', index);
const large = rules.municipalityBandInfo('001272', index);
const smallText = rules.bandDescription(small), largeText = rules.bandDescription(large);

assert.equal(small.band, 'fino-15000'); assert.equal(large.band, 'oltre-15000');
assert.match(smallText.title, /Fino a 15\.?000 abitanti \(2\.?584 abitanti\)/, 'Il titolo dice soglia e popolazione del comune');
assert.match(largeText.title, /Oltre 15\.?000 abitanti \(\d{2,3}\.?\d{3} abitanti\)/);
for (const [label, text] of [['piccolo', smallText], ['grande', largeText]]) {
  const all = `${text.title} ${text.body}`;
  assert.ok(!/premio di maggioranza/i.test(all), `${label}: nessuna promessa di premio di maggioranza`);
  assert.ok(/semplificat/i.test(text.body), `${label}: la semplificazione dei seggi è dichiarata`);
}
assert.ok(/solo se/i.test(largeText.body) && /metà dei voti validi/.test(largeText.body) && /ballottaggio/.test(largeText.body), 'Oltre i 15.000 il ballottaggio è condizionato al risultato del primo turno');
assert.ok(/senza ballottaggio/.test(smallText.body), 'Fino a 15.000 non c’è ballottaggio');
const refs = rules.MUNICIPAL_LEGAL_REFERENCES;
assert.ok(/267/.test(refs.law) && /71/.test(refs.law) && /73/.test(refs.law) && /non è stato verificato/.test(refs.verification), 'Riferimenti normativi indicati e dichiarati non verificati');
await access(new URL(`../${refs.document}`, import.meta.url));
const text = await readFile(new URL(`../${refs.document}`, import.meta.url), 'utf8');
assert.ok(/non è stato verificato/.test(text) && /popolazione di riferimento/.test(text) && /semplific/.test(text), 'Il documento dichiara verifica, popolazione di riferimento e semplificazioni');
const { SEAT_RULES } = await import(`../src/data/simulation/campaign-rules.js${v}`);
assert.ok(/semplificata/.test(SEAT_RULES.comunale.note) && /solo se nessuno supera il 50%/.test(SEAT_RULES.comunale.note), 'La nota delle regole dei seggi è onesta sulla semplificazione e sul ballottaggio');
console.log('Descrizioni delle fasce dei comuni verificate: soglia e popolazione, nessuna promessa automatica, riferimenti e avvertenza di verifica.');
