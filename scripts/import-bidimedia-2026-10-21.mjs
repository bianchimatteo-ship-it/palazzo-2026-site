// The BiDiMedia poll of October 2026 as the opening poll of the careers that start on or after 22 October (the Supermedia of 24 September and 1 October stay in the file as history).
// Source: https://sondaggibidimedia.com/sondaggio-bidimedia-ottobre-2026/ — the figures below are the ones given to the project as the table of that page (the survey of 21 October; published
// 22 October; fieldwork 17–19 October); the page could not be re-read from the environment that built this file, so `verificationNote` says so and the poll is "in-attesa-di-conferma".
// Four dates stay apart: fieldwork (17–19/10), the survey as the project was given it (referenceDate 2026-10-21), the original publication (2026-10-22) and the day the project recorded the figures.
// Mapping to the existing canonical IDs, no duplicates: «Casa Riformista–Italia Viva» → Italia Viva; «AVS» → the existing Alleanza Verdi e Sinistra entity; «Avanti–PSI» → the registered Partito Socialista
// Italiano (the only socialist party of the catalogue: an assumption, said in the poll's mapping note); «Progetto Civico Italia» is not in the catalogue and is added as a playable party with its name only
// (see addParty below): nothing else about it is invented. «Un'altra lista» (1.4) stays the aggregate «Altri», never a party. No coalition data is stored and no variation is invented (the source figures
// given to the project carry none). Run: node scripts/import-bidimedia-2026-10-21.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { writeDataVersion } from './lib/data-version.mjs';

const dir = fileURLToPath(new URL('../src/data/real/', import.meta.url));
const SOURCE_URL = 'https://sondaggibidimedia.com/sondaggio-bidimedia-ottobre-2026/';
const SOURCE_NAME = 'BiDiMedia — Sondaggio BiDiMedia di ottobre 2026 (rilevazione del 21 ottobre, pubblicata il 22 ottobre)';
const NEW_PARTY = 'party-progetto-civico-italia';
// [label in the game, canonical ID, share, label as the source writes it when different]
const ROWS = [
  ['Fratelli d’Italia', 'party-registro-p1-2014-04-ir', 26.5], ['Partito Democratico', 'party-registro-p1-2015-29-ir', 20.5], ['Movimento 5 Stelle', 'party-registro-p1-2022-63-ir', 12.0],
  ['Futuro Nazionale', 'party-futuro-nazionale', 7.2], ['Forza Italia', 'party-registro-p1-2015-20-ir', 6.7], ['Alleanza Verdi e Sinistra', 'coalition-alleanza-verdi-sinistra', 6.6, 'AVS'],
  ['Lega', 'party-registro-p1-2017-41-ir', 5.4], ['Azione', 'party-registro-p1-2019-51-ir', 3.0], ['Italia Viva', 'party-registro-p1-2019-52-ir', 2.0, 'Casa Riformista–Italia Viva'],
  ['Sud chiama Nord', 'party-registro-p1-2022-67-ir', 1.4, 'Sud Chiama Nord'], ['Più Europa', 'party-registro-p1-2018-47-ir', 1.1], ['Noi Moderati', 'party-registro-p1-2020-56-ir', 1.0],
  ['Progetto Civico Italia', NEW_PARTY, 1.0], ['Partito Liberaldemocratico', 'party-registro-p1-2024-74-ir', 0.8], ['Potere al Popolo', 'movement-potere-al-popolo', 0.8, 'Potere al Popolo'],
  ['Rifondazione Comunista', 'party-registro-p1-2014-01-ir', 0.8], ['Ora!', 'party-ora', 0.7], ['Partito Socialista Italiano', 'party-registro-p1-2014-05-ir', 0.6, 'Avanti–PSI'], ['UDC', 'party-registro-p1-2015-25-ir', 0.5]
];
const OTHERS = 1.4;
const round1 = value => Math.round(value * 10) / 10;
const total = round1(ROWS.reduce((sum, row) => sum + row[2], 0));
if (total !== 98.6 || round1(total + OTHERS) !== 100) throw new Error(`Le diciannove forze sommano ${total} e con «un’altra lista» ${round1(total + OTHERS)}: devono fare 98,6 e 100.`);

const read = async name => JSON.parse(await readFile(`${dir}${name}`, 'utf8'));
const write = (name, value) => writeFile(`${dir}${name}`, `${JSON.stringify(value, null, 2)}\n`);
const parties = await read('parties.json');
const movements = await read('political-movements.json');
const coalitions = await read('coalitions.json');
const known = new Set([...parties, ...movements, ...coalitions].map(item => item.id));
for (const [label, id] of ROWS) if (id !== NEW_PARTY && !known.has(id)) throw new Error(`${label}: l’ID ${id} non è nel catalogo.`);

// The only new entity: the name the source gives and nothing more (no colour, position, leader, description or founding date). Same shape as the other real parties; the logo fields are
// present and empty, so the player can add a personal logo like for every other party. Not read on its source: «in-attesa-di-conferma», like the poll.
const addParty = list => {
  const record = {
    entityType: 'party', officialName: 'Progetto Civico Italia', abbreviation: null, factualDescription: null, color: null, website: null, level: null, geographicArea: null, regionId: null,
    status: 'active', parliamentaryPresence: null, regionalPresence: null, localPresence: null, foundedAt: null, registeredAt: null, leadership: [],
    logoUrl: null, logoAsset: null, logoSource: null, logoVerified: null, logoAlt: null,
    id: NEW_PARTY, organizationType: 'partito', source: 'real', verified: false, verificationStatus: 'in-attesa-di-conferma',
    sourceUrl: SOURCE_URL, sourceName: SOURCE_NAME, transcribedAt: '2026-10-22', verifiedAt: null, validFrom: null, validTo: null, secondarySources: [],
    politicalPosition: null, positionSource: null, positionAsOf: null,
    verificationNote: 'La lista compare nella tabella del sondaggio BiDiMedia di ottobre 2026 (1,0%) come indicata dal committente del progetto; la pagina non era raggiungibile dall’ambiente di lavoro e non è stata riletta, e non è stata trovata altra fonte riletta. Dell’entità è registrato solo il nome: nessuna collocazione, sigla, colore, leader o data è stata inventata. Da confermare: denominazione ufficiale, esistenza come partito e, se serve, collocazione.'
  };
  const without = list.filter(item => item.id !== NEW_PARTY);
  return [...without, record];
};
await write('parties.json', addParty(parties));

const record = {
  id: 'poll-bidimedia-2026-10-21', kind: 'sondaggio', label: 'Sondaggio BiDiMedia', institute: 'BiDiMedia',
  referenceDate: '2026-10-21', publishedAt: '2026-10-22', fieldworkFrom: '2026-10-17', fieldworkTo: '2026-10-19',
  method: 'Sondaggio nazionale sulle intenzioni di voto, secondo la pubblicazione di BiDiMedia (campione e metodo non registrati dal progetto)',
  includedPolls: null,
  results: ROWS.map(([label, entityId, share, sourceLabel]) => ({ label, entityId, share, delta: null, ...(sourceLabel && sourceLabel !== label ? { sourceLabel } : {}) })),
  others: OTHERS, othersNote: 'Altri: «un’altra lista» della fonte (1,4%), una categoria aggregata e non un partito',
  mappingNote: 'Casa Riformista–Italia Viva è mappata all’ID esistente di Italia Viva; AVS all’entità esistente Alleanza Verdi e Sinistra; Avanti–PSI al Partito Socialista Italiano registrato (è l’unico partito socialista del catalogo: l’abbinamento è una scelta del progetto da confermare sulla fonte); Progetto Civico Italia è stato aggiunto al catalogo con il solo nome; Più Europa e +Europa sono la stessa entità. Nessun dato aggregato sulle coalizioni è registrato.',
  deltaNote: 'Nessuna variazione registrata: la fonte non ne ha fornite al progetto',
  coalitions: null,
  source: 'real', verified: false, verificationStatus: 'in-attesa-di-conferma',
  sourceUrl: SOURCE_URL, sourceName: SOURCE_NAME,
  transcribedAt: '2026-10-22', verifiedAt: null,
  verificationNote: 'Valori trascritti dalla tabella del sondaggio indicata dal committente del progetto; la pagina non era raggiungibile dall’ambiente di lavoro e non è stata riletta: da riconfermare alla prima occasione (diciannove forze 98,6% più «un’altra lista» 1,4%; date: rilevazione 17–19/10, sondaggio del 21/10 come dato al progetto, pubblicazione originale 22/10).',
  validFrom: '2026-10-22', validTo: null
};
const polls = (await read('polls.json')).filter(item => item.id !== record.id);
polls.push(record);
polls.sort((a, b) => String(a.publishedAt).localeCompare(String(b.publishedAt)));
await write('polls.json', polls);

for (const file of ['manifest.json', 'database.json']) {
  const json = await read(file);
  const manifest = file === 'manifest.json' ? json : json.manifest;
  if (file === 'database.json') json.parties = addParty(json.parties);
  if (!manifest) continue;
  if (file === 'manifest.json') { manifest.collections.realPolls = polls.length; manifest.collections.parties = parties.filter(item => item.id !== NEW_PARTY).length + 1; }
  if (file === 'database.json') manifest.collections.parties = json.parties.length;
  manifest.datasetVersion = '2026-10-22.1';
  manifest.pollsNote = 'Sondaggi reali: Supermedia del 24/09/2026 e del 01/10/2026 (storico) e sondaggio BiDiMedia di ottobre 2026 (rilevazione 17–19/10, pubblicato il 22/10/2026), apertura delle nuove carriere realistiche dal 22/10/2026.';
  await write(file, json);
}
console.log(`Sondaggio BiDiMedia registrato: ${ROWS.length} forze (${total}%), Altri ${OTHERS}%, ${polls.length} sondaggi reali nel file; Progetto Civico Italia aggiunto al catalogo (solo nome, in attesa di conferma).`);
console.log(`Dati reali: versione ${(await writeDataVersion()).version}.`);
