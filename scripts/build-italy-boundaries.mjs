// Builds src/data/real/italy-boundaries.json: the outline of the 20 regions and of the 110 provinces / metropolitan cities of Italy, as light SVG paths for the geographic map of the national elections.
//
// Source: openpolis/geojson-italy (https://github.com/openpolis/geojson-italy), "limits_IT_regions.geojson" and "limits_IT_provinces.geojson", the ISTAT boundaries at 1 January 2026
// (Confini delle unità amministrative a fini statistici), redistributed by Openpolis under CC BY 4.0 (the ISTAT data are CC BY 4.0 too). Attribution is kept in the output and shown on the map page.
// The boundaries are NOT drawn by hand and not altered, only simplified (Douglas-Peucker, about 1.3 km) and projected for the screen; islets below a threshold are omitted.
//
// Usage: node scripts/build-italy-boundaries.mjs <limits_IT_regions.geojson> <limits_IT_provinces.geojson> <source commit>
// (the two files are downloaded from https://raw.githubusercontent.com/openpolis/geojson-italy/<commit>/geojson/). The output is committed; the build of the site does not need the network.
import { readFile, writeFile } from 'node:fs/promises';

const [regionsFile, provincesFile, commit = 'ba3347df3a53352891109f8198c597a0273684c0'] = process.argv.slice(2);
if (!regionsFile || !provincesFile) { console.error('Uso: node scripts/build-italy-boundaries.mjs <regioni.geojson> <province.geojson> [commit]'); process.exit(1); }

const SCALE = 100;                 // units per degree of latitude
const LON_FACTOR = Math.cos(41.9 * Math.PI / 180);
const TOLERANCE = 1.3;             // simplification, in units (about 1.4 km)
const MIN_AREA = 9;                // polygons smaller than this (square units, about 100 km²) are omitted unless they are the largest of the area
const project = ([lon, lat]) => [lon * SCALE * LON_FACTOR, -lat * SCALE];

function simplify(points, tolerance) {
  if (points.length < 5) return points;
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, index = -1;
    const [ax, ay] = points[a], [bx, by] = points[b], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * (points[i][0] - ax) - dx * (points[i][1] - ay)) / len; if (d > max) { max = d; index = i; } }
    if (max > tolerance && index > 0) { keep[index] = 1; stack.push([a, index], [index, b]); }
  }
  return points.filter((_, i) => keep[i]);
}
// A closed ring: split at the point farthest from the start and simplify the two halves (a closed ring has no "line" from end to end).
function simplifyRing(points, tolerance) {
  const open = points.length > 1 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1] ? points.slice(0, -1) : points;
  if (open.length < 4) return open;
  let far = 1, best = -1;
  for (let i = 1; i < open.length; i++) { const d = Math.hypot(open[i][0] - open[0][0], open[i][1] - open[0][1]); if (d > best) { best = d; far = i; } }
  const first = simplify(open.slice(0, far + 1), tolerance), second = simplify([...open.slice(far), open[0]], tolerance);
  return [...first, ...second.slice(1, -1)];
}
const area = ring => Math.abs(ring.reduce((sum, p, i) => { const q = ring[(i + 1) % ring.length]; return sum + (p[0] * q[1] - q[0] * p[1]); }, 0)) / 2;

// All the polygons of a feature: [outer, ...holes] in projected coordinates.
const polygonsOf = geometry => (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []).map(rings => rings.map(ring => ring.map(project)));

function build(features, { id, name }) {
  const out = [];
  for (const feature of features) {
    let polygons = polygonsOf(feature.geometry);
    const biggest = Math.max(...polygons.map(rings => area(rings[0])));
    polygons = polygons.filter(rings => area(rings[0]) >= MIN_AREA || area(rings[0]) === biggest);
    out.push({ feature, polygons, ...id(feature.properties), name: name(feature.properties) });
  }
  return out;
}
const bounds = items => items.flatMap(item => item.polygons.flatMap(rings => rings[0]));
const all = [];
const regions = build(JSON.parse(await readFile(regionsFile, 'utf8')).features, { id: p => ({ code: p.reg_istat_code }), name: p => p.reg_name });
const provinces = build(JSON.parse(await readFile(provincesFile, 'utf8')).features, { id: p => ({ code: p.prov_istat_code, region: p.reg_istat_code, sigla: p.prov_acr, kind: p.prov_tipo_uts }), name: p => p.prov_name });
all.push(...bounds(regions));
const minX = Math.min(...all.map(p => p[0])), minY = Math.min(...all.map(p => p[1])), maxX = Math.max(...all.map(p => p[0])), maxY = Math.max(...all.map(p => p[1]));
const PAD = 4;
const width = Math.ceil(maxX - minX) + PAD * 2, height = Math.ceil(maxY - minY) + PAD * 2;
const place = ([x, y]) => [Math.round(x - minX + PAD), Math.round(y - minY + PAD)];

const pathOf = polygons => polygons.flatMap(rings => rings.map(ring => {
  const pts = simplifyRing(ring.map(place), TOLERANCE).filter((p, i, list) => i === 0 || p[0] !== list[i - 1][0] || p[1] !== list[i - 1][1]);
  if (pts.length > 1 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop();
  if (pts.length < 3) return '';
  let d = `M${pts[0][0]} ${pts[0][1]}`, [px, py] = pts[0];
  for (const [x, y] of pts.slice(1)) { d += `l${x - px} ${y - py}`; px = x; py = y; }
  return `${d}z`;
})).join('');
// The label point: the middle of the bounding box of the largest polygon.
const centreOf = polygons => {
  const biggest = polygons.reduce((best, rings) => area(rings[0]) > area(best[0]) ? rings : best, polygons[0]);
  const pts = biggest[0].map(place), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return [Math.round((Math.min(...xs) + Math.max(...xs)) / 2), Math.round((Math.min(...ys) + Math.max(...ys)) / 2)];
};

// Region names as the electoral map of the game writes them (Eligendo): the join is made on the ISTAT code, the name is the one the rest of the game uses.
const GAME_NAMES = { 'Valle d\'Aosta/Vallée d\'Aoste': 'Valle d’Aosta', 'Trentino-Alto Adige/Südtirol': 'Trentino-Alto Adige' };
const regionName = name => GAME_NAMES[name] ?? name;

const doc = {
  source: 'real',
  status: 'importato',
  verified: true,
  verifiedAt: '2026-10-19',
  verificationNote: 'Importato dal commit indicato di openpolis/geojson-italy (confini ISTAT al 1 gennaio 2026); i codici ISTAT di regioni e province coincidono con quelli dei collegi e dei comuni del gioco. Non è stato confrontato con il file originale ISTAT.',
  title: 'Confini amministrativi d’Italia: regioni e province (semplificati)',
  vintage: '2026-01-01',
  sourceName: 'ISTAT — Confini delle unità amministrative a fini statistici, al 1 gennaio 2026, nella redistribuzione di Openpolis (geojson-italy)',
  sourceUrl: 'https://github.com/openpolis/geojson-italy',
  sourceCommit: commit,
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: 'Confini: ISTAT (CC BY 4.0), elaborati da Openpolis (CC BY 4.0). Semplificati e proiettati per lo schermo da POLITICANDO 2026.',
  processing: `Proiezione equirettangolare (latitudine centrale 41,9°), semplificazione Douglas-Peucker di circa 1,3 km, isolotti sotto circa 100 km² omessi; nessun confine disegnato a mano.`,
  generatedBy: 'scripts/build-italy-boundaries.mjs',
  viewBox: [0, 0, width, height],
  regions: regions.map(item => ({ code: item.code, name: regionName(item.name), c: centreOf(item.polygons), d: pathOf(item.polygons) })).sort((a, b) => a.code.localeCompare(b.code)),
  provinces: provinces.map(item => ({ code: item.code, region: item.region, name: item.name, sigla: item.sigla, kind: item.kind, c: centreOf(item.polygons), d: pathOf(item.polygons) })).sort((a, b) => a.code.localeCompare(b.code))
};
const text = JSON.stringify(doc);
await writeFile(new URL('../src/data/real/italy-boundaries.json', import.meta.url), text);
console.log(`italy-boundaries.json: ${doc.regions.length} regioni, ${doc.provinces.length} province, ${(text.length / 1024).toFixed(0)} KB, viewBox ${width}×${height}.`);

// The manifest of the real data lists the document, so the game asks for it (loadOptionalRealDocument) and the offline cache keeps it.
const manifestUrl = new URL('../src/data/real/manifest.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
manifest.documents = { ...manifest.documents, italyBoundaries: { file: 'italy-boundaries.json', regions: doc.regions.length, provinces: doc.provinces.length, vintage: doc.vintage, license: doc.license, sourceUrl: doc.sourceUrl, sourceCommit: doc.sourceCommit, simplifiedTo: '~1.3 km' } };
await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);
console.log('manifest.json: documento italyBoundaries registrato.');
