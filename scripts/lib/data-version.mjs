// The version stamp of the real data files (the `?v=` the loader puts on every JSON it asks for): the dataset version of the manifest plus a hash of the content of the files that are
// published, so new data can never be served under an old stamp and the stamp never moves without a change in the data.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../../src/data/real/', import.meta.url));
const target = fileURLToPath(new URL('../../src/data/repositories/real-data.js', import.meta.url));
// database.json is the build-time snapshot: the game never asks for it, Workers does not publish it.
const SKIP = new Set(['database.json']);

export async function computeDataVersion() {
  const names = (await readdir(dir)).filter(name => name.endsWith('.json') && !SKIP.has(name)).sort();
  const hash = createHash('sha256');
  for (const name of names) hash.update(`${name}\n`).update(await readFile(`${dir}${name}`)).update('\n');
  const manifest = JSON.parse(await readFile(`${dir}manifest.json`, 'utf8'));
  return `${manifest.datasetVersion}-${hash.digest('hex').slice(0, 10)}`;
}
export async function currentDataVersion() {
  return (await readFile(target, 'utf8')).match(/REAL_DATA_ASSET_VERSION\s*=\s*'([^']+)'/)?.[1] ?? null;
}
export async function writeDataVersion() {
  const version = await computeDataVersion();
  const source = await readFile(target, 'utf8');
  const next = source.replace(/(REAL_DATA_ASSET_VERSION\s*=\s*')[^']+(')/, `$1${version}$2`);
  if (next !== source) await writeFile(target, next);
  return { version, changed: next !== source };
}
