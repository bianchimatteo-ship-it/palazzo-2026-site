// Reading the official ISTAT population files of the comuni and joining them to the comuni of the game by ISTAT code. Pure functions (no file or network access): the importer
// (scripts/import-istat-popolazione-comuni.mjs) reads the files and writes the data; the test (scripts/check-istat-population.mjs) runs the same code on fixtures.
// Two files can be given, and they are never mixed up:
//   - the resident population on 1 January 2026 (demo.istat.it, “Popolazione residente per sesso, età e stato civile”: CSV in a ZIP), a statistic;
//   - the legal population of the last census (SITUAS / results of the permanent census), the reference the electoral rules require.
// Nothing is completed with an estimate: a comune with no value stays without one, and the report says so.
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

export const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
const norm = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// ---------- zip (stored or deflated), only what an ISTAT archive needs ----------
export function unzip(buffer) {
  let end = buffer.length - 22;
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error('Archivio ZIP non riconosciuto.');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Archivio ZIP danneggiato: indice non valido.');
    const method = buffer.readUInt16LE(offset + 10);
    const size = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28), extraLength = buffer.readUInt16LE(offset + 30), commentLength = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const data = buffer.subarray(start, start + size);
    if (method !== 0 && method !== 8) throw new Error(`Metodo di compressione ZIP non supportato (${method}).`);
    files.set(name, method === 8 ? inflateRawSync(data) : Buffer.from(data));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}
// The text of a file: the first CSV of an archive, or the CSV itself.
export function csvTextOf(buffer, name = '') {
  const bytes = /\.zip$/i.test(name) || buffer.readUInt32LE(0) === 0x04034b50 ? (([...unzip(buffer)].filter(([file]) => /\.csv$/i.test(file)).sort(([a], [b]) => a.localeCompare(b))[0] ?? [])[1] ?? (() => { throw new Error('Nessun file CSV nell’archivio.'); })()) : buffer;
  const utf8 = bytes.toString('utf8');
  return (utf8.includes('�') ? new TextDecoder('windows-1252').decode(bytes) : utf8).replace(/^﻿/, '');
}

// ---------- csv ----------
export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  const probe = lines.slice(0, 5).join('\n');
  const delimiter = [';', ',', '\t', '|'].map(d => [d, probe.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const split = line => {
    const out = []; let cell = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (quoted) { if (char === '"' && line[i + 1] === '"') { cell += '"'; i++; } else if (char === '"') quoted = false; else cell += char; }
      else if (char === '"') quoted = true; else if (char === delimiter) { out.push(cell); cell = ''; } else cell += char;
    }
    out.push(cell);
    return out.map(item => item.trim());
  };
  return lines.map(split);
}
// Some files open with a title or a note before the header: the header is the first row that names a code and something else.
function headerIndex(rows, needs) {
  return rows.findIndex(row => needs.every(test => row.some(cell => test.test(norm(cell)))));
}
const wholeNumber = text => {
  const clean = String(text ?? '').replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (clean === '' || !/^-?\d+(\.0+)?$/.test(clean)) return null;
  return Number(clean);
};
const codeOf = text => { const digits = String(text ?? '').replace(/\D/g, ''); return digits && digits.length <= 6 ? digits.padStart(6, '0') : null; };

// The resident population: one row per comune with a total, or one row per comune and age (the totals of the ages are summed; the row of the whole age range is not counted twice).
export function readResident(text) {
  const rows = parseCsv(text);
  const at = headerIndex(rows, [/codice|pro com|istat/, /comune|denominazione/]);
  if (at < 0) throw new Error('Intestazione non riconosciuta: servono una colonna con il codice ISTAT del comune e una con il nome.');
  const header = rows[at].map(norm);
  const find = (...tests) => header.findIndex(cell => tests.some(test => test.test(cell)));
  const code = find(/codice istat del comune|codice comune|pro com|^codice$|^istat$/);
  const name = find(/^comune$|denominazione|nome comune/);
  const age = find(/^eta$|classe di eta|^age$/);
  const total = find(/^totale$|totale complessivo|popolazione residente|^popolazione$|^totale maschi e femmine$/);
  const males = find(/totale maschi|^maschi$/), females = find(/totale femmine|^femmine$/);
  if (code < 0) throw new Error('Colonna del codice ISTAT del comune non trovata.');
  if (total < 0 && !(males >= 0 && females >= 0)) throw new Error('Colonna del totale della popolazione non trovata (né maschi e femmine).');
  const byCode = new Map(), problems = [];
  for (const [index, row] of rows.slice(at + 1).entries()) {
    const key = codeOf(row[code]);
    if (!key) { if (row.some(Boolean)) problems.push(`riga ${at + index + 2}: codice comune non valido («${row[code]}»)`); continue; }
    const value = total >= 0 ? wholeNumber(row[total]) : (wholeNumber(row[males]) ?? NaN) + (wholeNumber(row[females]) ?? NaN);
    if (value === null || Number.isNaN(value)) { problems.push(`riga ${at + index + 2}: totale non numerico per ${key}`); continue; }
    if (value < 0) { problems.push(`riga ${at + index + 2}: totale negativo per ${key}`); continue; }
    if (age >= 0) {
      const label = norm(row[age]);
      if (/^(totale|tutte le eta|999|total)$/.test(label)) { const entry = byCode.get(key) ?? { code: key, name: row[name] ?? null, sum: 0, whole: null }; entry.whole = value; byCode.set(key, entry); continue; }
      const entry = byCode.get(key) ?? { code: key, name: row[name] ?? null, sum: 0, whole: null };
      entry.sum += value; byCode.set(key, entry);
    } else {
      if (byCode.has(key)) { problems.push(`codice ${key} ripetuto`); continue; }
      byCode.set(key, { code: key, name: row[name] ?? null, sum: value, whole: null });
    }
  }
  const out = new Map();
  for (const [key, entry] of byCode) {
    // when both the ages and the total of the ages are there, they must agree
    if (entry.whole !== null && entry.sum > 0 && entry.whole !== entry.sum) problems.push(`codice ${key}: il totale (${entry.whole}) non coincide con la somma delle età (${entry.sum})`);
    out.set(key, { code: key, name: entry.name, population: entry.sum > 0 ? entry.sum : entry.whole ?? 0 });
  }
  return { layout: age >= 0 ? 'per-eta' : 'totale-comune', rows: out, problems };
}

// The legal population of the census: a code and a population (the column that names the legal population or the census).
export function readLegal(text) {
  const rows = parseCsv(text);
  const at = headerIndex(rows, [/codice|pro com|istat/, /popolazione|abitanti|residenti/]);
  if (at < 0) throw new Error('Intestazione non riconosciuta: servono il codice ISTAT del comune e la popolazione legale.');
  const header = rows[at].map(norm);
  const code = header.findIndex(cell => /codice istat del comune|codice comune|pro com|^codice$|^istat$/.test(cell));
  const value = header.findIndex(cell => /popolazione legale|popolazione censimento|^popolazione$|abitanti|residenti/.test(cell));
  const name = header.findIndex(cell => /^comune$|denominazione|nome comune/.test(cell));
  if (code < 0 || value < 0) throw new Error('Colonne del codice o della popolazione legale non trovate.');
  const map = new Map(), problems = [];
  for (const [index, row] of rows.slice(at + 1).entries()) {
    const key = codeOf(row[code]);
    if (!key) continue;
    const population = wholeNumber(row[value]);
    if (population === null || population < 0) { problems.push(`riga ${at + index + 2}: popolazione non valida per ${key}`); continue; }
    if (map.has(key)) { problems.push(`codice ${key} ripetuto`); continue; }
    map.set(key, { code: key, name: row[name] ?? null, population });
  }
  return { rows: map, problems };
}

// ---------- the join with the comuni of the game, the document and the report ----------
// municipalities: [{ code, name }] (src/data/real/municipalities.json). Returns { document, report, ok } and never writes anything.
export function buildPopulation({ municipalities, resident = null, legal = null, meta }) {
  const known = new Map(municipalities.map(item => [item.code, item]));
  const problems = [...(resident?.problems ?? []), ...(legal?.problems ?? [])];
  const records = [];
  const withoutResident = [], withoutLegal = [], zero = [];
  for (const comune of [...municipalities].sort((a, b) => a.code.localeCompare(b.code))) {
    const r = resident?.rows.get(comune.code) ?? null, l = legal?.rows.get(comune.code) ?? null;
    if (resident && !r) withoutResident.push(comune.code);
    if (legal && !l) withoutLegal.push(comune.code);
    if (r && r.population === 0) zero.push(comune.code);
    if (!r && !l) continue;
    records.push({
      municipalityCode: comune.code,
      populationResident: r ? r.population : null,
      populationReferenceDate: r ? meta.residentReferenceDate : null,
      electoralPopulationReference: l ? l.population : null,
      electoralPopulationReferenceType: l ? meta.legalType : null,
      electoralPopulationReferenceDate: l ? meta.legalReferenceDate : null,
      electoralRuleSource: l ? meta.legalRuleSource : null
    });
  }
  const unmatched = [...(resident?.rows.keys() ?? []), ...(legal?.rows.keys() ?? [])].filter((code, index, list) => !known.has(code) && list.indexOf(code) === index).sort();
  const total = municipalities.length;
  const report = {
    generatedAt: meta.importedAt, comuniInGame: total,
    resident: resident ? { file: meta.residentFile, hash: meta.residentHash, layout: resident.layout, rows: resident.rows.size, matched: total - withoutResident.length, withoutValue: withoutResident, zeroValues: zero, referenceDate: meta.residentReferenceDate, sum: [...resident.rows.values()].filter(row => known.has(row.code)).reduce((sum, row) => sum + row.population, 0) } : null,
    legal: legal ? { file: meta.legalFile, hash: meta.legalHash, rows: legal.rows.size, matched: total - withoutLegal.length, withoutValue: withoutLegal, referenceDate: meta.legalReferenceDate } : null,
    unmatchedCodes: unmatched, problems,
    coverage: { resident: resident ? Math.round((total - withoutResident.length) / total * 10000) / 100 : null, legal: legal ? Math.round((total - withoutLegal.length) / total * 10000) / 100 : null }
  };
  const ok = problems.length === 0 && unmatched.length === 0 && zero.length === 0 && (!resident || withoutResident.length === 0) && (!legal || withoutLegal.length === 0) && records.length > 0;
  const document = {
    id: 'municipal-population', source: 'real', verified: ok, status: records.length ? 'importato' : 'non-importato', importedAt: meta.importedAt,
    sourceName: meta.sourceName, sourceUrl: meta.sourceUrl, residentDataset: resident ? { title: meta.residentTitle, referenceDate: meta.residentReferenceDate, file: meta.residentFile, hash: meta.residentHash, url: meta.residentUrl } : null,
    legalDataset: legal ? { title: meta.legalTitle, type: meta.legalType, referenceDate: meta.legalReferenceDate, file: meta.legalFile, hash: meta.legalHash, ruleSource: meta.legalRuleSource } : null,
    note: 'La fascia elettorale di un comune dipende dal riferimento previsto dalla norma (electoralPopulationReference), non dalla popolazione residente; i valori mancanti restano null.',
    records
  };
  return { document, report, ok };
}
