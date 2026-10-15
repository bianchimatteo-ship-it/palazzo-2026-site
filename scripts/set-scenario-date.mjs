// The day every new career starts (the "scenario date"), kept apart from the day the real data was last verified (the "snapshot date"):
// the manifest says both, the game starts on the first and shows the second as the age of the data. Usage: node scripts/set-scenario-date.mjs 2026-10-12
// The date must be a Monday (game weeks start on Monday) and cannot be before the snapshot. Nothing else in the real data changes.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { writeDataVersion } from './lib/data-version.mjs';

const date = process.argv[2] ?? '2026-10-12';
if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).getUTCDay() !== 1) { console.error(`${date}: serve un lunedì in formato AAAA-MM-GG.`); process.exit(1); }
const dir = fileURLToPath(new URL('../src/data/real/', import.meta.url));
const NOTE = 'La carriera inizia alla data dello scenario; i dati reali (Parlamento, governo, partiti, sondaggio) sono quelli verificati alla data dello snapshot. Nessuna fonte pubblicata dopo la data dello scenario è stata usata.';
for (const file of ['manifest.json', 'database.json']) {
  const path = `${dir}${file}`;
  const json = JSON.parse(await readFile(path, 'utf8'));
  const manifest = file === 'manifest.json' ? json : json.manifest;
  if (!manifest) continue;
  if (date < manifest.snapshotDate) { console.error(`${file}: la data dello scenario (${date}) precede lo snapshot (${manifest.snapshotDate}).`); process.exit(1); }
  manifest.scenarioDate = date;
  manifest.scenarioNote = NOTE;
  await writeFile(path, `${JSON.stringify(json, null, 2)}\n`);
}
console.log(`Data dello scenario: ${date}.`);
console.log(`Dati reali: versione ${(await writeDataVersion()).version}.`);
