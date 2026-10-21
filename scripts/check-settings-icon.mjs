// L'icona SVG delle Impostazioni: la causa del difetto era il tracciato (relativo, scritto a mano, con archi arbitrari: un ingranaggio gobbo e fuori centro). Ora è un ingranaggio a otto denti
// generato in coordinate assolute attorno al centro del riquadro 24×24: simmetrico, dentro il riquadro, con il foro centrale. Una sola definizione, usata dalla barra, dalla pagina e dal menu «Altro».
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/ui/app.js', import.meta.url), 'utf8');
const definitions = [...source.matchAll(/\bsettings: '(<circle[^']*)'/g)];
assert.equal(definitions.length, 1, 'Una sola definizione dell’icona «settings».');
const markup = definitions[0][1];
assert.ok(/<circle cx="12" cy="12" r="3"\/>/.test(markup), 'Foro centrale al centro del riquadro.');
const path = markup.match(/<path d="([^"]+)"/)?.[1] ?? '';
assert.ok(path && !/[a-z]/.test(path.replace(/[A]/g, '')) , 'Tracciato in coordinate assolute (nessun comando relativo).');
const numbers = path.replace(/[A-Za-z]/g, ' ').trim().split(/[\s,]+/).map(Number);
assert.ok(numbers.every(Number.isFinite), 'Numeri validi.');
// the points of the outline are the L/M ones (an arc command has seven numbers: radii, rotation, flags, x, y)
const points = [];
for (const [, command, args] of path.matchAll(/([MLA])([^MLAZ]*)/g)) {
  const values = args.trim().split(/[\s,]+/).map(Number);
  if (command === 'A') points.push([values[5], values[6]]); else points.push([values[0], values[1]]);
}
if (points.length > 1 && Math.hypot(points[0][0] - points.at(-1)[0], points[0][1] - points.at(-1)[1]) < 0.01) points.pop(); // the closing arc ends where the outline began
assert.ok(points.length >= 25, `Un ingranaggio a otto denti (${points.length} punti).`);
assert.ok(points.every(([x, y]) => x >= 1 && x <= 23 && y >= 1 && y <= 23), 'Il simbolo sta dentro il riquadro 24×24, con il margine del tratto.');
const centre = points.reduce(([a, b], [x, y]) => [a + x / points.length, b + y / points.length], [0, 0]);
assert.ok(Math.abs(centre[0] - 12) < 0.05 && Math.abs(centre[1] - 12) < 0.05, `Centrato a 12,12 (${centre.map(value => value.toFixed(3))}).`);
const rotate = ([x, y], degrees) => { const a = degrees * Math.PI / 180; const dx = x - 12, dy = y - 12; return [12 + dx * Math.cos(a) - dy * Math.sin(a), 12 + dx * Math.sin(a) + dy * Math.cos(a)]; };
const near = ([x, y]) => points.some(([u, v]) => Math.hypot(u - x, v - y) < 0.06);
assert.ok(points.every(point => near(rotate(point, 45))), 'Simmetria a otto denti: ruotato di 45° il contorno coincide con sé stesso.');
const radii = points.map(([x, y]) => Math.hypot(x - 12, y - 12));
assert.ok(Math.max(...radii) <= 9.8 && Math.min(...radii) >= 7.3, `Denti e corpo hanno le proporzioni giuste (${Math.min(...radii).toFixed(2)}–${Math.max(...radii).toFixed(2)}).`);
console.log('Icona delle Impostazioni verificata: ingranaggio a otto denti, coordinate assolute, centrato, simmetrico, dentro il riquadro 24×24, una sola definizione.');
