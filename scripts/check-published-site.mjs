import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const DEFAULT_URL = 'https://bianchimatteo-ship-it.github.io/palazzo-2026-site/';
const defaultPageUrl = new URL(process.argv[2] || DEFAULT_URL);
if (!defaultPageUrl.pathname.endsWith('/')) defaultPageUrl.pathname += '/';
const localIndexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const indexVersion = localIndexSource.match(/main\.js\?v=([^"']+)/)?.[1];
if (!indexVersion) throw new Error('Versione cache di index.html non trovata nel progetto locale');
const pageUrl = new URL(defaultPageUrl);
if (!process.argv[2]) pageUrl.searchParams.set('v', indexVersion);
const root = new URL('../', import.meta.url);
const files = {
  parties:'parties.json', politicalMovements:'political-movements.json', politicalFigures:'political-figures.json', partyLeaderships:'party-leaderships.json',
  parliamentaryGroups:'parliamentary-groups.json', coalitions:'coalitions.json', electoralLists:'electoral-lists.json', politicians:'politicians.json',
  offices:'offices.json', partyMemberships:'party-memberships.json', groupMemberships:'group-memberships.json', electionParticipations:'election-participations.json',
  partyMembershipHistory:'party-membership-history.json', parliamentaryGroupHistory:'parliamentary-group-history.json', officeHistory:'office-history.json',
  territories:'territories.json', elections:'elections.json', chambers:'chambers.json'
};
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const SPECIFIER = /(?:from\s+|import\s*\(\s*)['"](\.{1,2}\/[^'"]+?\.js)(?:\?v=([^'"]*))?['"]/g;

// Local consistency first: every module and stylesheet must carry the version index.html asks for.
async function localModuleGraph() {
  const seen = new Map();
  const visit = async path => {
    if (seen.has(path)) return;
    const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
    seen.set(path, source);
    for (const [, relative, version] of source.matchAll(SPECIFIER)) {
      const target = new URL(relative, new URL(`http://local/${path}`)).pathname.slice(1);
      assert(version === indexVersion, `${path} importa ${relative} con versione ${version ?? 'assente'} invece di ${indexVersion}`);
      await visit(target);
    }
  };
  await visit('src/main.js');
  return seen;
}
const localModules = await localModuleGraph();
const stylesheets = [...localIndexSource.matchAll(/<link rel="stylesheet" href="\.\/([^"?]+\.css)\?v=([^"]+)"/g)].map(([, path, version]) => { assert(version === indexVersion, `${path} è collegato con la versione ${version}`); return path; });
async function get(url) {
  const response = await fetch(url, { signal:AbortSignal.timeout(30000), headers:{'cache-control':'no-cache'} });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return { response, bytes:Buffer.from(await response.arrayBuffer()) };
}
async function localJson(name) { return JSON.parse(await readFile(new URL(`../src/data/real/${name}`, import.meta.url), 'utf8')); }
function hash(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

try {
  const { bytes:indexBytes } = await get(pageUrl);
  const html = indexBytes.toString('utf8');
  assert(hash(indexBytes) === hash(Buffer.from(localIndexSource)), 'index.html live è diverso dal progetto locale');
  assert(/<title>POLITICANDO 2026/.test(html), 'Titolo HTML non trovato');
  const mainPath = html.match(/<script[^>]+src=["']([^"']*main\.js(?:\?[^"']*)?)["']/i)?.[1];
  if (!mainPath) throw new Error('index.html pubblicato non riferisce src/main.js');
  const mainUrl = new URL(mainPath, pageUrl);
  const localMainBytes = await readFile(new URL('../src/main.js', import.meta.url));
  const { bytes:remoteMainBytes } = await get(mainUrl);
  assert(hash(remoteMainBytes) === hash(localMainBytes), 'src/main.js live è diverso dal progetto locale');
  const mainSource = remoteMainBytes.toString('utf8');
  assert(/loadRealDatabase\s*\(/.test(mainSource) && /loadRealCollections\s*\(\s*\[['"]parties['"],\s*['"]politicalMovements['"]\]/.test(mainSource), 'Avvio pubblicato non carica manifest e partiti reali');
  assert(!/database\.json/.test(mainSource), 'main.js pubblicato richiede il JSON aggregato');

  const repoImport = mainSource.match(/from\s+["']([^"']*repositories\/real-data\.js(?:\?[^"']*)?)["']/);
  if (!repoImport) throw new Error('main.js non importa il repository dati reali');
  const repositoryUrl = new URL(repoImport[1], mainUrl);
  const { bytes:remoteRepositoryBytes } = await get(repositoryUrl);
  const localRepositoryBytes = await readFile(new URL('../src/data/repositories/real-data.js', import.meta.url));
  assert(hash(remoteRepositoryBytes) === hash(localRepositoryBytes), 'Repository real-data.js live è diverso dal progetto locale');
  const repositorySource = remoteRepositoryBytes.toString('utf8');
  assert(!/database\.json/.test(repositorySource), 'Repository live scarica il JSON aggregato');
  const version = repositorySource.match(/REAL_DATA_ASSET_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1];
  if (!version) throw new Error('Versione cache dei dati non trovata nel repository live');
  const assetBase = new URL('../real/', repositoryUrl);
  const manifestUrl = new URL('manifest.json', assetBase);
  manifestUrl.searchParams.set('v', version);
  const [{ bytes:manifestBytes }, localManifest] = await Promise.all([get(manifestUrl), localJson('manifest.json')]);
  const liveManifest = JSON.parse(manifestBytes.toString('utf8'));
  assert(JSON.stringify(liveManifest) === JSON.stringify(localManifest), 'Manifest remoto non corrisponde allo snapshot locale');
  assert(liveManifest.snapshotDate === '2026-09-22', `Snapshot pubblicato inatteso: ${liveManifest.snapshotDate}`);

  const collections = await Promise.all(Object.entries(files).map(async ([name,file]) => {
    const url = new URL(file, assetBase); url.searchParams.set('v', version);
    const [{ bytes }, localRecords] = await Promise.all([get(url), localJson(file)]);
    const records = JSON.parse(bytes.toString('utf8'));
    const expectedCount = liveManifest.collections[name];
    assert(Array.isArray(records), `${name}: JSON live non è un array`);
    assert(records.length === localRecords.length, `${name}: conteggio live ${records.length}, atteso ${localRecords.length}`);
    if (Number.isInteger(expectedCount)) assert(records.length === expectedCount, `${name}: conteggio live ${records.length}, atteso dal manifest ${expectedCount}`);
    assert(JSON.stringify(records) === JSON.stringify(localRecords), `${name}: dati live diversi dai file locali`);
    return [name,records];
  }));
  const db = Object.fromEntries(collections);
  const parties = [...db.parties,...db.politicalMovements];
  assert(db.parties.length === 69 && db.politicalMovements.length === 2, 'Conteggi pubblicati dei partiti/movimenti non corrispondono');
  assert(db.politicians.length === 604 && db.parliamentaryGroups.length === 22, 'Conteggi pubblicati di politici/gruppi non corrispondono');
  assert(db.politicalFigures.length === 4 && db.partyLeaderships.length === 4, 'Figure politiche o incarichi di partito mancanti');
  for (const [name,records] of Object.entries(db)) for (const record of records) {
    assert(record.source === 'real' && record.verified === true && record.sourceUrl && record.sourceName && record.verifiedAt, `${name}/${record.id}: provenienza non verificata`);
  }
  const partyIds = new Set(parties.map(item => item.id));
  const figureIds = new Set(db.politicalFigures.map(item => item.id));
  const politicianIds = new Set(db.politicians.map(item => item.id));
  const groupIds = new Set(db.parliamentaryGroups.map(item => item.id));
  for (const item of db.partyLeaderships) assert(partyIds.has(item.partyId) && figureIds.has(item.politicalFigureId), `Leadership senza riferimenti: ${item.id}`);
  for (const item of db.groupMemberships) assert(politicianIds.has(item.politicianId) && groupIds.has(item.groupId), `Appartenenza senza riferimenti: ${item.id}`);
  for (const entity of parties) for (const field of ['logoUrl','logoAsset','logoSource','logoVerified','logoAlt']) assert(field in entity, `${entity.id}: manca campo logo ${field}`);

  const bundledLogo = parties.find(item => item.id === 'party-futuro-nazionale')?.logoAsset;
  if (bundledLogo) {
    const logoUrl = new URL(bundledLogo, pageUrl);
    const [{ bytes:liveLogo }, localLogo] = await Promise.all([get(logoUrl), readFile(new URL(`../${bundledLogo.replace(/^\.\//,'' )}`, import.meta.url))]);
    assert(hash(liveLogo) === hash(localLogo), 'Logo verificato live diverso dal file locale');
    assert(liveLogo.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'Logo pubblicato non è un PNG valido');
  } else assert(false, 'Asset del logo verificato non associato a Futuro Nazionale');

  for (const asset of stylesheets) {
    const live = new URL(asset, pageUrl); live.searchParams.set('v', mainUrl.searchParams.get('v') ?? version);
    try {
      const [{ bytes }, expected] = await Promise.all([get(live), readFile(new URL(`../${asset}`, import.meta.url))]);
      assert(hash(bytes) === hash(expected), `${asset} live diverso dal file locale`);
    } catch (error) { failures.push(`${asset} non disponibile nella versione pubblicata (${error.message})`); }
  }
  // Every module reachable from main.js must be online and identical to the local file.
  for (const [path, source] of localModules) {
    const live = new URL(path, pageUrl); live.searchParams.set('v', indexVersion);
    try {
      const { bytes } = await get(live);
      assert(hash(bytes) === hash(Buffer.from(source)), `${path} live diverso dal file locale`);
    } catch (error) { failures.push(`${path} non disponibile nella versione pubblicata (${error.message})`); }
  }
  if (failures.length) throw new Error(`Verifica Pages fallita:\n- ${failures.join('\n- ')}`);
  console.log(`GitHub Pages verificato: ${pageUrl.href}`);
  console.log(`Snapshot ${liveManifest.snapshotDate}; ${db.parties.length} partiti, ${db.politicalMovements.length} movimenti, ${db.politicians.length} parlamentari, ${db.parliamentaryGroups.length} gruppi.`);
  console.log(`${Object.keys(files).length} collezioni live, ${localModules.size} moduli JS e ${stylesheets.length} fogli di stile verificati con la versione ${indexVersion}; hash remoti uguali ai file locali.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
